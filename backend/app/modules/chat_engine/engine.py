"""
Module 8: AI Compliance Chat Engine
ChatGPT-like conversational AI for compliance document analysis.
Users upload documents and ask questions about standards, policies,
compliance gaps, and improvements.
"""

import logging
import json
import re
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime
import hashlib

from app.config.settings import settings

logger = logging.getLogger(__name__)


# In-memory conversation store (use Redis/DB in production)
_conversations: Dict[str, Dict] = {}


class ComplianceChatEngine:
    """
    AI-powered compliance chatbot engine.
    Processes documents and answers compliance questions using
    NLP matching against framework controls.
    """

    def __init__(self):
        self.frameworks_data: Dict[str, Dict] = {}
        self._load_frameworks()
        # Lazy imports for heavy modules
        self._nlp_engine = None
        self._document_processor = None
        self._cia_validator = None
        self._llm = None

    # ------------------------------------------------------------------
    # Lazy accessors
    # ------------------------------------------------------------------
    @property
    def nlp(self):
        if self._nlp_engine is None:
            try:
                from app.modules.nlp_engine import nlp_engine
                self._nlp_engine = nlp_engine
            except Exception as e:
                logger.warning(f"NLP engine not available: {e}")
        return self._nlp_engine

    @property
    def doc_processor(self):
        if self._document_processor is None:
            try:
                from app.modules.document_processor import document_processor
                self._document_processor = document_processor
            except Exception as e:
                logger.warning(f"Document processor not available: {e}")
        return self._document_processor

    @property
    def cia(self):
        if self._cia_validator is None:
            try:
                from app.modules.cia_validator import cia_validator
                self._cia_validator = cia_validator
            except Exception as e:
                logger.warning(f"CIA validator not available: {e}")
        return self._cia_validator

    @property
    def llm(self):
        """Lazy-load the Llama LLM provider."""
        if self._llm is None:
            try:
                from app.modules.llm_provider import llm_provider
                if llm_provider.is_available:
                    self._llm = llm_provider
                    logger.info("LLM provider connected to chat engine")
                else:
                    logger.info("LLM provider not available — using rule-based responses")
            except Exception as e:
                logger.warning(f"LLM provider not available: {e}")
        return self._llm

    # ------------------------------------------------------------------
    # Framework data
    # ------------------------------------------------------------------
    def _load_frameworks(self):
        """Load compliance framework data from JSON files."""
        try:
            frameworks_dir = Path(settings.FRAMEWORKS_DATA_DIR)
            mapping = {
                'iso27001': 'iso27001_controls.json',
                'iso9001': 'iso9001_requirements.json',
                'nist': 'nist_csf.json',
                'gdpr': 'pdpa_gdpr.json',
            }
            for key, fname in mapping.items():
                fp = frameworks_dir / fname
                if fp.exists():
                    with open(fp, 'r', encoding='utf-8') as f:
                        self.frameworks_data[key] = json.load(f)
                    logger.info(f"Chat engine loaded framework: {key}")
        except Exception as e:
            logger.error(f"Failed to load frameworks in chat engine: {e}")

    def _framework_summary(self, key: str) -> str:
        data = self.frameworks_data.get(key, {})
        name = data.get('name', key.upper())
        controls = data.get('controls', [])
        return f"{name} ({len(controls)} controls)"

    # ------------------------------------------------------------------
    # Conversation management
    # ------------------------------------------------------------------
    def create_conversation(self, conversation_id: str) -> Dict:
        """Create a new conversation context."""
        conv = {
            'id': conversation_id,
            'created_at': datetime.utcnow().isoformat(),
            'messages': [],
            'document': None,          # processed document data
            'document_name': None,
            'document_clauses': [],
            'analysis_cache': {},       # cache per-framework results
        }
        _conversations[conversation_id] = conv
        return conv

    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        return _conversations.get(conversation_id)

    def delete_conversation(self, conversation_id: str):
        _conversations.pop(conversation_id, None)

    # ------------------------------------------------------------------
    # Document handling
    # ------------------------------------------------------------------
    def attach_document(self, conversation_id: str, file_path: str, file_name: str) -> Dict:
        """
        Process and attach a document to the conversation.
        Returns a summary dict.
        """
        conv = _conversations.get(conversation_id)
        if conv is None:
            conv = self.create_conversation(conversation_id)

        try:
            if self.doc_processor is not None:
                result = self.doc_processor.process_document(file_path)
                clauses = result.get('clauses', [])
            else:
                # Fallback: basic extraction without full NLP pipeline
                clauses = self._basic_extract(file_path, file_name)
                result = {
                    'file_hash': hashlib.sha256(open(file_path, 'rb').read()).hexdigest(),
                    'word_count': sum(len(c.get('text', '').split()) for c in clauses),
                    'sections': [],
                    'clauses': clauses,
                }

            # Store the full text for LLM context
            full_text = result.get('full_text', '')
            if not full_text and clauses:
                full_text = '\n'.join(c.get('text', '') for c in clauses)

            conv['document'] = result
            conv['document_name'] = file_name
            conv['document_clauses'] = clauses
            conv['document_full_text'] = full_text
            conv['analysis_cache'] = {}  # reset cache on new doc

            logger.info(f"Document attached: {file_name}, {len(clauses)} clauses, {len(full_text)} chars of text")

            summary = {
                'file_name': file_name,
                'clauses_extracted': len(clauses),
                'word_count': result.get('word_count', 0),
                'sections': len(result.get('sections', [])),
            }
            return summary

        except Exception as e:
            logger.error(f"Document attach error: {e}", exc_info=True)
            raise

    def _build_document_context(self, conv: Dict, max_chars: int = 12000) -> str:
        """Build a context string with the document content for LLM calls."""
        doc_name = conv.get('document_name', 'Unknown')
        full_text = conv.get('document_full_text', '')
        clauses = conv.get('document_clauses', [])

        parts = [f"Document: {doc_name}"]
        parts.append(f"Total clauses: {len(clauses)}")

        if full_text:
            truncated = full_text[:max_chars]
            if len(full_text) > max_chars:
                truncated += f"\n... [truncated, {len(full_text)} total chars]"
            parts.append(f"\n--- DOCUMENT CONTENT ---\n{truncated}\n--- END DOCUMENT ---")
        elif clauses:
            parts.append("\nDocument clauses:")
            char_count = 0
            for cl in clauses:
                txt = cl.get('text', '')
                sec = cl.get('section', '?')
                entry = f"[Section {sec}]: {txt}"
                if char_count + len(entry) > max_chars:
                    parts.append("... [more clauses truncated]")
                    break
                parts.append(entry)
                char_count += len(entry)

        return "\n".join(parts)

    def _basic_extract(self, file_path: str, file_name: str) -> List[Dict]:
        """Very basic extraction fallback."""
        ext = Path(file_name).suffix.lower()
        text = ""
        try:
            if ext == '.pdf':
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        t = page.extract_text()
                        if t:
                            text += t + "\n"
            elif ext == '.docx':
                from docx import Document as DocxDoc
                doc = DocxDoc(file_path)
                text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            logger.error(f"Basic extract failed: {e}")

        # Split into clauses by sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        clauses = []
        for i, s in enumerate(sentences):
            s = s.strip()
            if len(s) > 20:
                clauses.append({'section': str(i + 1), 'text': s})
        return clauses

    # ------------------------------------------------------------------
    # Core chat handler
    # ------------------------------------------------------------------
    def chat(self, conversation_id: str, user_message: str) -> str:
        """
        Process a user message and return an AI response.
        """
        conv = _conversations.get(conversation_id)
        if conv is None:
            conv = self.create_conversation(conversation_id)

        # Store user message
        conv['messages'].append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.utcnow().isoformat(),
        })

        # Determine intent and generate response
        response_text = self._generate_response(conv, user_message)

        # Store assistant message
        conv['messages'].append({
            'role': 'assistant',
            'content': response_text,
            'timestamp': datetime.utcnow().isoformat(),
        })

        return response_text

    # ------------------------------------------------------------------
    # Intent detection & response generation
    # ------------------------------------------------------------------
    def _generate_response(self, conv: Dict, message: str) -> str:
        msg_lower = message.lower().strip()

        # Greeting
        if self._is_greeting(msg_lower):
            return self._greeting_response(conv)

        # No document uploaded yet – try LLM for any question, fallback to guide
        if not conv.get('document_clauses'):
            if self.llm is not None:
                try:
                    history = conv.get('messages', [])[-6:]
                    llm_messages = [{"role": m["role"], "content": m["content"]} for m in history]
                    if not llm_messages or llm_messages[-1]["content"] != message:
                        llm_messages.append({"role": "user", "content": message})
                    return self.llm.generate(
                        messages=llm_messages,
                        context_info="The user has NOT uploaded a compliance document yet. "
                                     "Answer their question naturally. If it relates to compliance, "
                                     "mention they can upload a document for detailed analysis.",
                    )
                except Exception as e:
                    logger.error(f"LLM error (no-doc chat): {e}")
            # LLM not available — rule-based fallback
            if self._is_general_question(msg_lower):
                return self._answer_general_question(msg_lower)
            return self._no_document_response()

        # Document-aware intents
        if self._wants_full_analysis(msg_lower):
            return self._full_analysis_response(conv)

        if self._wants_framework_check(msg_lower):
            framework = self._detect_framework(msg_lower)
            return self._framework_analysis_response(conv, framework)

        if self._wants_cia_analysis(msg_lower):
            return self._cia_analysis_response(conv)

        if self._wants_missing_controls(msg_lower):
            framework = self._detect_framework(msg_lower) or 'iso27001'
            return self._missing_controls_response(conv, framework)

        if self._wants_weak_policies(msg_lower):
            return self._weak_policies_response(conv)

        if self._wants_improvements(msg_lower):
            return self._improvements_response(conv)

        if self._wants_summary(msg_lower):
            return self._document_summary_response(conv)

        if self._is_general_question(msg_lower):
            return self._answer_general_question(msg_lower)

        # Default: try LLM-powered contextual answer, then rule-based fallback
        return self._contextual_answer(conv, message)

    # ------------------------------------------------------------------
    # Intent detectors
    # ------------------------------------------------------------------
    def _is_greeting(self, msg: str) -> bool:
        greets = ['hello', 'hi', 'hey', 'good morning', 'good afternoon',
                   'good evening', 'greetings', 'howdy']
        return any(msg.startswith(g) for g in greets) and len(msg.split()) <= 5

    def _wants_full_analysis(self, msg: str) -> bool:
        patterns = ['full analysis', 'analyze (?:my|the|this) document', 'complete (?:check|analysis|review)',
                     'check everything', 'run full', 'analyze everything', 'full compliance']
        return any(re.search(p, msg) for p in patterns)

    def _wants_framework_check(self, msg: str) -> bool:
        kw = ['iso 27001', 'iso27001', 'iso 9001', 'iso9001', 'nist', 'gdpr', 'pdpa',
               'framework', 'standard', 'check against', 'comply with', 'compliance with']
        return any(k in msg for k in kw)

    def _wants_cia_analysis(self, msg: str) -> bool:
        kw = ['cia', 'confidentiality', 'integrity', 'availability', 'cia balance',
               'cia triad', 'security pillars', 'cia analysis']
        return any(k in msg for k in kw)

    def _wants_missing_controls(self, msg: str) -> bool:
        kw = ['missing', 'gap', 'not covered', 'what is missing', 'controls missing',
               'gaps', 'lacking', 'absent', 'not addressed']
        return any(k in msg for k in kw)

    def _wants_weak_policies(self, msg: str) -> bool:
        kw = ['weak', 'vague', 'ambiguous', 'unclear', 'problematic',
               'mistake', 'error', 'wrong', 'issue', 'problem', 'flaw']
        return any(k in msg for k in kw)

    def _wants_improvements(self, msg: str) -> bool:
        kw = ['improve', 'recommendation', 'suggest', 'fix', 'better', 'enhance',
               'strengthen', 'what should', 'how to improve', 'how can i']
        return any(k in msg for k in kw)

    def _wants_summary(self, msg: str) -> bool:
        kw = ['summary', 'summarize', 'overview', 'brief', 'quick look', 'tell me about']
        return any(k in msg for k in kw)

    def _is_general_question(self, msg: str) -> bool:
        kw = ['what is', 'explain', 'define', 'difference between', 'how does',
               'why is', 'tell me about', 'what are']
        return any(k in msg for k in kw)

    def _detect_framework(self, msg: str) -> Optional[str]:
        if 'iso 27001' in msg or 'iso27001' in msg:
            return 'iso27001'
        if 'iso 9001' in msg or 'iso9001' in msg:
            return 'iso9001'
        if 'nist' in msg:
            return 'nist'
        if 'gdpr' in msg or 'pdpa' in msg:
            return 'gdpr'
        return None

    # ------------------------------------------------------------------
    # Response builders
    # ------------------------------------------------------------------
    def _greeting_response(self, conv: Dict) -> str:
        doc = conv.get('document_name')
        if doc:
            return (
                f"Hello! 👋 I have your document **{doc}** loaded. "
                "You can ask me things like:\n\n"
                "• \"Check this against ISO 27001\"\n"
                "• \"What are the missing controls?\"\n"
                "• \"Show me weak policies\"\n"
                "• \"How can I improve my compliance?\"\n"
                "• \"Do a CIA analysis\"\n"
                "• \"Give me a full compliance analysis\"\n\n"
                "What would you like to know?"
            )
        return (
            "Hello! 👋 I'm your **AI Compliance Guard**.\n\n"
            "I can help you analyze compliance documents against standards like "
            "ISO 27001, ISO 9001, NIST CSF, and GDPR/PDPA.\n\n"
            "**To get started**, upload a PDF or DOCX document using the attachment button, "
            "then ask me about compliance gaps, weak policies, or improvements.\n\n"
            "You can also ask me general compliance questions anytime!"
        )

    def _no_document_response(self) -> str:
        return (
            "📄 **No document uploaded yet.**\n\n"
            "Please upload a compliance policy document (PDF or DOCX) first, "
            "then I can analyze it against various standards.\n\n"
            "Use the **📎 attachment button** to upload your document.\n\n"
            "In the meantime, you can ask me general compliance questions like:\n"
            "• \"What is ISO 27001?\"\n"
            "• \"Explain the CIA triad\"\n"
            "• \"What is GDPR?\""
        )

    def _document_summary_response(self, conv: Dict) -> str:
        # Use LLM for a rich summary if available
        if self.llm is not None:
            context_info = self._build_document_context(conv)
            try:
                return self.llm.generate(
                    messages=[{"role": "user", "content": "Give me a comprehensive summary of this document. Include the main topics, key policies, and any compliance-relevant sections."}],
                    context_info=context_info,
                    max_tokens=4096,
                )
            except Exception as e:
                logger.error(f"LLM summary error: {e}")

        # Fallback: static summary
        doc = conv.get('document', {})
        name = conv.get('document_name', 'Unknown')
        clauses = conv.get('document_clauses', [])
        word_count = doc.get('word_count', 0)
        sections = doc.get('sections', [])

        lines = [
            f"## 📄 Document Summary: {name}\n",
            f"- **Total clauses extracted:** {len(clauses)}",
            f"- **Word count:** {word_count:,}",
            f"- **Sections identified:** {len(sections)}\n",
        ]

        if sections:
            lines.append("**Sections found:**")
            for i, sec in enumerate(sections[:10], 1):
                header = sec.get('header', 'Unknown')[:60]
                lines.append(f"  {i}. {header}")
            if len(sections) > 10:
                lines.append(f"  ... and {len(sections) - 10} more sections")

        lines.append("\n💡 Ask me to check this document against specific standards!")
        return "\n".join(lines)

    def _full_analysis_response(self, conv: Dict) -> str:
        """Run analysis against all frameworks and CIA."""
        clauses = conv.get('document_clauses', [])
        name = conv.get('document_name', 'document')

        lines = [f"## 🔍 Full Compliance Analysis: {name}\n"]

        # Per-framework analysis
        for fw_key in ['iso27001', 'iso9001', 'nist', 'gdpr']:
            result = self._run_framework_analysis(conv, fw_key)
            if result:
                pct = result.get('compliance_percentage', 0)
                matched = result.get('matched_controls_count', 0)
                total = result.get('total_controls', 0)
                missing_count = len(result.get('missing_controls', []))
                emoji = '🟢' if pct >= 70 else ('🟡' if pct >= 50 else '🔴')
                fw_name = self.frameworks_data.get(fw_key, {}).get('name', fw_key.upper())
                lines.append(f"### {emoji} {fw_name}")
                lines.append(f"- Compliance: **{pct}%**")
                lines.append(f"- Matched controls: {matched}/{total}")
                lines.append(f"- Missing controls: {missing_count}")
                lines.append("")

        # CIA analysis
        cia_result = self._run_cia_analysis(conv)
        if cia_result:
            bi = cia_result.get('cia_balance_index', 0)
            rating = cia_result.get('balance_rating', 'N/A')
            cov = cia_result.get('cia_coverage', {})
            lines.append(f"### 🛡️ CIA Balance Analysis")
            lines.append(f"- Balance Index: **{bi}** ({rating})")
            lines.append(f"- Confidentiality: {cov.get('confidentiality', 0)}%")
            lines.append(f"- Integrity: {cov.get('integrity', 0)}%")
            lines.append(f"- Availability: {cov.get('availability', 0)}%")
            lines.append("")

        # Top recommendations
        lines.append("### 💡 Top Recommendations\n")
        recs = self._build_recommendations(conv)
        for i, r in enumerate(recs[:7], 1):
            lines.append(f"{i}. {r}")

        return "\n".join(lines)

    def _framework_analysis_response(self, conv: Dict, framework: Optional[str]) -> str:
        if framework is None:
            framework = 'iso27001'

        result = self._run_framework_analysis(conv, framework)
        if not result:
            return f"Sorry, I couldn't analyze against **{framework}**. Framework data may not be available."

        fw_name = self.frameworks_data.get(framework, {}).get('name', framework.upper())
        pct = result.get('compliance_percentage', 0)
        matched = result.get('matched_controls_count', 0)
        total = result.get('total_controls', 0)
        missing = result.get('missing_controls', [])
        weak = result.get('weak_clauses', [])

        emoji = '🟢' if pct >= 70 else ('🟡' if pct >= 50 else '🔴')

        lines = [
            f"## {emoji} {fw_name} Compliance Check\n",
            f"**Overall Compliance: {pct}%**\n",
            f"- Matched controls: **{matched}** / {total}",
            f"- Missing controls: **{len(missing)}**",
            f"- Weak clauses detected: **{len(weak)}**\n",
        ]

        if missing:
            lines.append("### ❌ Top Missing Controls\n")
            for ctrl in missing[:8]:
                cid = ctrl.get('control_id', '?')
                title = ctrl.get('title', '')
                priority = ctrl.get('priority', 'Medium')
                p_emoji = '🔴' if priority in ('Critical', 'High') else '🟡'
                lines.append(f"- {p_emoji} **{cid}**: {title} *(Priority: {priority})*")
            if len(missing) > 8:
                lines.append(f"- ... and {len(missing) - 8} more missing controls")
            lines.append("")

        if weak:
            lines.append("### ⚠️ Weak Policy Statements\n")
            for w in weak[:5]:
                clause = w.get('clause', '')[:80]
                reason = w.get('reason', 'Weak language')
                lines.append(f"- \"{clause}...\" — *{reason}*")
            lines.append("")

        lines.append("💡 Ask me \"how to improve\" for specific recommendations!")
        return "\n".join(lines)

    def _cia_analysis_response(self, conv: Dict) -> str:
        result = self._run_cia_analysis(conv)
        if not result:
            return "Sorry, I couldn't perform CIA analysis at this time."

        bi = result.get('cia_balance_index', 0)
        rating = result.get('balance_rating', 'N/A')
        cov = result.get('cia_coverage', {})
        dist = result.get('cia_distribution', {})
        imbalances = result.get('imbalances', [])
        recs = result.get('recommendations', [])

        lines = [
            "## 🛡️ CIA Triad Analysis\n",
            f"**CIA Balance Index: {bi}/100** ({rating})\n",
            "### Coverage Breakdown\n",
            f"- 🔒 **Confidentiality**: {cov.get('confidentiality', 0)}% ({dist.get('confidentiality', 0)} clauses)",
            f"- ✅ **Integrity**: {cov.get('integrity', 0)}% ({dist.get('integrity', 0)} clauses)",
            f"- 🔄 **Availability**: {cov.get('availability', 0)}% ({dist.get('availability', 0)} clauses)\n",
        ]

        if imbalances:
            lines.append("### ⚠️ Imbalances Detected\n")
            for imb in imbalances:
                cat = imb.get('category', '').capitalize()
                sev = imb.get('severity', 'Medium')
                risk = imb.get('risk', imb.get('note', ''))
                lines.append(f"- **{cat}** ({sev}): {risk}")
            lines.append("")

        if recs:
            lines.append("### 💡 Recommendations\n")
            for r in recs:
                lines.append(f"- {r}")

        return "\n".join(lines)

    def _missing_controls_response(self, conv: Dict, framework: str) -> str:
        result = self._run_framework_analysis(conv, framework)
        if not result:
            return f"Couldn't analyze for missing controls against {framework}."

        missing = result.get('missing_controls', [])
        fw_name = self.frameworks_data.get(framework, {}).get('name', framework.upper())

        if not missing:
            return f"✅ Great news! No critical missing controls detected against **{fw_name}**."

        lines = [
            f"## ❌ Missing Controls — {fw_name}\n",
            f"**{len(missing)} controls are not addressed** in your document:\n",
        ]

        # Group by priority
        critical = [c for c in missing if c.get('priority') in ('Critical', 'High')]
        medium = [c for c in missing if c.get('priority') == 'Medium']
        low = [c for c in missing if c.get('priority') == 'Low']

        if critical:
            lines.append(f"### 🔴 Critical/High Priority ({len(critical)})\n")
            for c in critical[:10]:
                lines.append(f"- **{c.get('control_id')}**: {c.get('title')} *({c.get('category', '')})*")
            lines.append("")

        if medium:
            lines.append(f"### 🟡 Medium Priority ({len(medium)})\n")
            for c in medium[:8]:
                lines.append(f"- **{c.get('control_id')}**: {c.get('title')}")
            if len(medium) > 8:
                lines.append(f"- ... and {len(medium) - 8} more")
            lines.append("")

        if low:
            lines.append(f"### 🟢 Low Priority ({len(low)})\n")
            lines.append(f"- {len(low)} low-priority controls not addressed")
            lines.append("")

        lines.append("💡 Ask me \"how to improve\" for specific guidance on addressing these gaps!")
        return "\n".join(lines)

    def _weak_policies_response(self, conv: Dict) -> str:
        clauses = conv.get('document_clauses', [])
        weak_indicators = [
            'may', 'might', 'could', 'should consider', 'as appropriate',
            'where possible', 'if feasible', 'efforts will be made',
            'try to', 'attempt to', 'when practical'
        ]

        weak_clauses = []
        for clause in clauses:
            text = clause.get('text', '')
            text_lower = text.lower()
            found = [ind for ind in weak_indicators if ind in text_lower]
            if found:
                weak_clauses.append({
                    'text': text,
                    'section': clause.get('section', '?'),
                    'indicators': found,
                })

        # Also check for too-short clauses
        short_clauses = [c for c in clauses if len(c.get('text', '').split()) < 10]

        lines = [
            "## ⚠️ Weak & Problematic Policy Statements\n",
        ]

        if not weak_clauses and not short_clauses:
            return "✅ **No obvious weak policy statements detected.** Your document uses strong, definitive language."

        if weak_clauses:
            lines.append(f"### Found {len(weak_clauses)} clauses with weak/vague language:\n")
            for i, w in enumerate(weak_clauses[:10], 1):
                text_preview = w['text'][:120]
                indicators = ', '.join(w['indicators'])
                lines.append(f"**{i}. Section {w['section']}:**")
                lines.append(f"> \"{text_preview}...\"")
                lines.append(f"- ❌ Weak terms: *{indicators}*")
                lines.append(f"- ✅ **Fix:** Replace with mandatory language (\"shall\", \"must\", \"will\")")
                lines.append("")

        if short_clauses:
            lines.append(f"\n### ⚡ {len(short_clauses)} very short clauses detected")
            lines.append("These may lack sufficient detail for auditors:\n")
            for c in short_clauses[:5]:
                lines.append(f"- \"{c.get('text', '')}\"")

        lines.append("\n💡 **Best Practice:** Use words like **\"shall\"**, **\"must\"**, **\"will\"** "
                      "instead of \"may\", \"might\", \"should consider\".")
        return "\n".join(lines)

    def _improvements_response(self, conv: Dict) -> str:
        clauses = conv.get('document_clauses', [])
        recs = self._build_recommendations(conv)

        lines = [
            "## 💡 Improvement Recommendations\n",
            f"Based on analyzing **{len(clauses)} clauses** in your document:\n",
        ]

        if not recs:
            lines.append("Your document appears well-structured. Consider periodic reviews to maintain compliance.")
        else:
            for i, r in enumerate(recs, 1):
                lines.append(f"### {i}. {r}\n")

        lines.append("\n---\n*Ask me about specific frameworks or controls for more detailed guidance.*")
        return "\n".join(lines)

    def _build_recommendations(self, conv: Dict) -> List[str]:
        """Aggregate recommendations from all analyses."""
        recs = []

        # Framework recommendations
        for fw in ['iso27001', 'iso9001', 'nist', 'gdpr']:
            result = self._run_framework_analysis(conv, fw)
            if result:
                pct = result.get('compliance_percentage', 0)
                missing = result.get('missing_controls', [])
                fw_name = self.frameworks_data.get(fw, {}).get('name', fw.upper())
                if pct < 70:
                    critical_missing = [c for c in missing if c.get('priority') in ('Critical', 'High')]
                    if critical_missing:
                        ctrl_ids = ', '.join(c.get('control_id', '') for c in critical_missing[:3])
                        recs.append(
                            f"**Address critical {fw_name} gaps** — Missing high-priority controls: {ctrl_ids}. "
                            f"Current compliance is only {pct}%."
                        )

        # CIA recommendations
        cia = self._run_cia_analysis(conv)
        if cia:
            for imb in cia.get('imbalances', []):
                if imb.get('type') == 'under_covered':
                    cat = imb.get('category', '').capitalize()
                    recs.append(
                        f"**Strengthen {cat} controls** — Currently at {imb.get('percentage', 0)}%, "
                        f"target is 25-40%."
                    )

        # Weak policy recommendation
        clauses = conv.get('document_clauses', [])
        weak_count = sum(1 for c in clauses
                         if any(w in c.get('text', '').lower()
                                for w in ['may', 'might', 'could', 'should consider']))
        if weak_count > 0:
            recs.append(
                f"**Fix {weak_count} weak policy statements** — Replace vague language "
                f"(may, might, could) with mandatory terms (shall, must, will)."
            )

        if not recs:
            recs.append("Your document shows good compliance coverage. Continue with regular reviews.")

        return recs

    def _answer_general_question(self, msg: str) -> str:
        """Answer general compliance questions — LLM or canned responses."""
        # ── Try LLM for open-ended questions ──
        if self.llm is not None:
            try:
                return self.llm.generate(
                    messages=[{"role": "user", "content": msg}],
                    context_info="The user has NOT uploaded a document yet. Answer the general compliance question.",
                    max_tokens=512,
                )
            except Exception as e:
                logger.error(f"LLM general-question error: {e}")

        # ── Rule-based fallback ──
        responses = {
            'iso 27001': (
                "## ISO/IEC 27001:2022\n\n"
                "ISO 27001 is the international standard for **Information Security Management Systems (ISMS)**.\n\n"
                "**Key aspects:**\n"
                "- 93 controls across 4 themes (Organizational, People, Physical, Technological)\n"
                "- Risk-based approach to information security\n"
                "- Annex A contains the control objectives\n"
                "- Requires continuous improvement (Plan-Do-Check-Act)\n\n"
                "Upload your document to check compliance against all 93+ controls!"
            ),
            'iso 9001': (
                "## ISO 9001:2015\n\n"
                "ISO 9001 is the standard for **Quality Management Systems (QMS)**.\n\n"
                "**Key principles:**\n"
                "- Customer focus\n"
                "- Leadership engagement\n"
                "- Process approach\n"
                "- Evidence-based decision making\n"
                "- Continuous improvement\n\n"
                "It covers 10 clauses from Context of Organization to Improvement."
            ),
            'nist': (
                "## NIST Cybersecurity Framework (CSF)\n\n"
                "NIST CSF provides a **policy framework for cybersecurity**.\n\n"
                "**Core functions:**\n"
                "1. **Identify** — Asset management, risk assessment\n"
                "2. **Protect** — Access control, training, data security\n"
                "3. **Detect** — Anomaly detection, monitoring\n"
                "4. **Respond** — Response planning, communications\n"
                "5. **Recover** — Recovery planning, improvements\n\n"
                "108 subcategories across these 5 functions."
            ),
            'gdpr': (
                "## GDPR / PDPA\n\n"
                "**GDPR** (General Data Protection Regulation) is the EU's data privacy law.\n"
                "**PDPA** (Personal Data Protection Act) is the equivalent in several Asian countries.\n\n"
                "**Key principles:**\n"
                "- Lawfulness, fairness, transparency\n"
                "- Purpose limitation\n"
                "- Data minimization\n"
                "- Accuracy\n"
                "- Storage limitation\n"
                "- Integrity & confidentiality\n"
                "- Accountability"
            ),
            'cia': (
                "## CIA Triad\n\n"
                "The CIA Triad is the foundation of information security:\n\n"
                "- 🔒 **Confidentiality** — Only authorized people can access information\n"
                "- ✅ **Integrity** — Data is accurate, complete, and unaltered\n"
                "- 🔄 **Availability** — Systems/data are accessible when needed\n\n"
                "A good security policy should balance all three pillars. "
                "Upload your document and I'll calculate the **CIA Balance Index**!"
            ),
            'compliance': (
                "## What is Compliance?\n\n"
                "Compliance means **adhering to laws, regulations, standards, and policies** "
                "that apply to your organization.\n\n"
                "I can help you check compliance against:\n"
                "- **ISO 27001** — Information Security\n"
                "- **ISO 9001** — Quality Management\n"
                "- **NIST CSF** — Cybersecurity\n"
                "- **GDPR/PDPA** — Data Privacy\n\n"
                "Upload your policy document to get started!"
            ),
        }

        for keyword, response in responses.items():
            if keyword in msg:
                return response

        return (
            "I can help you with compliance-related questions! Here are some topics I know about:\n\n"
            "- **ISO 27001** — Information Security Management\n"
            "- **ISO 9001** — Quality Management\n"
            "- **NIST CSF** — Cybersecurity Framework\n"
            "- **GDPR/PDPA** — Data Privacy\n"
            "- **CIA Triad** — Confidentiality, Integrity, Availability\n\n"
            "Ask me about any of these, or upload a document for detailed analysis!"
        )

    def _contextual_answer(self, conv: Dict, message: str) -> str:
        """Try LLM first with full document context, then fall back to keyword matching."""
        clauses = conv.get('document_clauses', [])

        # ── LLM path — send full document content ──
        if self.llm is not None:
            context_info = self._build_document_context(conv)

            # Build conversation history for the LLM (last 6 messages)
            history = conv.get('messages', [])[-6:]
            llm_messages = [{"role": m["role"], "content": m["content"]} for m in history]
            # Ensure the current user message is the last one
            if not llm_messages or llm_messages[-1]["content"] != message:
                llm_messages.append({"role": "user", "content": message})

            try:
                return self.llm.generate(
                    messages=llm_messages,
                    context_info=context_info,
                    max_tokens=4096,
                )
            except Exception as e:
                logger.error(f"LLM generation error: {e}")
                # Fall through to rule-based

        # ── Rule-based fallback — keyword scoring ──
        msg_lower = message.lower()
        words = set(re.findall(r'\b\w{4,}\b', msg_lower))

        scored_clauses = []
        for clause in clauses:
            text_lower = clause.get('text', '').lower()
            clause_words = set(re.findall(r'\b\w{4,}\b', text_lower))
            overlap = len(words & clause_words)
            if overlap > 0:
                scored_clauses.append((overlap, clause))
        scored_clauses.sort(key=lambda x: x[0], reverse=True)
        top_clauses = scored_clauses[:5]

        # ── Rule-based fallback ──
        if not clauses:
            return self._answer_general_question(message.lower())

        if not top_clauses:
            return (
                "I couldn't find specific content in your document related to that question.\n\n"
                "Try asking:\n"
                "• \"Check this against ISO 27001\"\n"
                "• \"What controls are missing?\"\n"
                "• \"Show me weak policies\"\n"
                "• \"Do a full analysis\""
            )

        lines = [
            f"## 📋 Relevant Findings from Your Document\n",
            f"Based on your question, here are the most relevant clauses:\n",
        ]
        for score, clause in top_clauses:
            text = clause.get('text', '')[:200]
            section = clause.get('section', '?')
            lines.append(f"**Section {section}:**")
            lines.append(f"> {text}")
            lines.append("")

        lines.append("💡 For a comprehensive check, try: \"Do a full analysis\" or \"Check against ISO 27001\"")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Internal analysis runners (with caching)
    # ------------------------------------------------------------------
    def _run_framework_analysis(self, conv: Dict, framework: str) -> Optional[Dict]:
        cache_key = f"fw_{framework}"
        if cache_key in conv.get('analysis_cache', {}):
            return conv['analysis_cache'][cache_key]

        clauses = conv.get('document_clauses', [])
        if not clauses:
            return None

        try:
            if self.nlp is not None:
                result = self.nlp.analyze_document_compliance(clauses, framework)
            else:
                result = self._basic_framework_check(clauses, framework)
            conv.setdefault('analysis_cache', {})[cache_key] = result
            return result
        except Exception as e:
            logger.error(f"Framework analysis error ({framework}): {e}")
            return None

    def _run_cia_analysis(self, conv: Dict) -> Optional[Dict]:
        cache_key = "cia"
        if cache_key in conv.get('analysis_cache', {}):
            return conv['analysis_cache'][cache_key]

        clauses = conv.get('document_clauses', [])
        if not clauses:
            return None

        try:
            if self.cia is not None:
                result = self.cia.analyze_document_cia(clauses)
            else:
                result = self._basic_cia_check(clauses)
            conv.setdefault('analysis_cache', {})[cache_key] = result
            return result
        except Exception as e:
            logger.error(f"CIA analysis error: {e}")
            return None

    # ------------------------------------------------------------------
    # Fallback analysis (when NLP models not loaded)
    # ------------------------------------------------------------------
    def _basic_framework_check(self, clauses: List[Dict], framework: str) -> Dict:
        """Keyword-based framework check when NLP model is not available."""
        fw_data = self.frameworks_data.get(framework, {})
        controls = fw_data.get('controls', [])

        if not controls:
            return {
                'framework': framework,
                'compliance_percentage': 0,
                'matched_controls_count': 0,
                'total_controls': 0,
                'missing_controls': [],
                'weak_clauses': [],
                'total_clauses': len(clauses),
                'matched_clauses': 0,
            }

        all_text = " ".join(c.get('text', '').lower() for c in clauses)
        matched = set()

        for ctrl in controls:
            title_words = set(re.findall(r'\b\w{4,}\b', ctrl.get('title', '').lower()))
            desc_words = set(re.findall(r'\b\w{4,}\b', ctrl.get('description', '').lower()))
            keywords = title_words | desc_words
            if keywords:
                overlap = sum(1 for w in keywords if w in all_text)
                if overlap >= max(1, len(keywords) * 0.2):
                    matched.add(ctrl.get('id', ''))

        total = len(controls)
        pct = round((len(matched) / total) * 100, 2) if total else 0

        missing = [
            {
                'control_id': c.get('id', ''),
                'title': c.get('title', ''),
                'category': c.get('category', 'General'),
                'priority': c.get('priority', 'Medium'),
            }
            for c in controls if c.get('id', '') not in matched
        ]

        # Sort by priority
        priority_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
        missing.sort(key=lambda x: priority_order.get(x.get('priority', 'Medium'), 2))

        return {
            'framework': framework,
            'compliance_percentage': pct,
            'matched_controls_count': len(matched),
            'total_controls': total,
            'missing_controls': missing[:20],
            'weak_clauses': [],
            'total_clauses': len(clauses),
            'matched_clauses': min(len(clauses), len(matched)),
        }

    def _basic_cia_check(self, clauses: List[Dict]) -> Dict:
        """Basic CIA check using keywords."""
        cia_kw = {
            'confidentiality': ['confidential', 'privacy', 'access control', 'encryption',
                                 'authentication', 'authorization', 'secret', 'sensitive'],
            'integrity': ['integrity', 'accuracy', 'validation', 'audit trail',
                           'change control', 'verification', 'hash', 'checksum'],
            'availability': ['availability', 'backup', 'recovery', 'uptime',
                              'redundancy', 'disaster', 'resilience', 'failover'],
        }
        dist = {'confidentiality': 0, 'integrity': 0, 'availability': 0}
        for clause in clauses:
            text = clause.get('text', '').lower()
            scores = {}
            for cat, kws in cia_kw.items():
                scores[cat] = sum(1 for k in kws if k in text)
            primary = max(scores, key=scores.get)
            if scores[primary] > 0:
                dist[primary] += 1

        total = len(clauses)
        coverage = {
            cat: round((cnt / total) * 100, 2) if total else 0
            for cat, cnt in dist.items()
        }

        import numpy as np
        vals = list(coverage.values())
        std_dev = np.std(vals)
        bi = round(100 - (std_dev / 47.14) * 100, 2)
        rating = 'Excellent' if bi >= 85 else ('Good' if bi >= 70 else ('Fair' if bi >= 50 else 'Poor'))

        return {
            'total_clauses': total,
            'cia_coverage': coverage,
            'cia_distribution': dist,
            'cia_balance_index': bi,
            'balance_rating': rating,
            'imbalances': [],
            'recommendations': [],
        }


# Singleton instance
chat_engine = ComplianceChatEngine()
