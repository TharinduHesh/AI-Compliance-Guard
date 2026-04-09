"""
Layer 1  ─  Rule-Based Structural Compliance Engine
=====================================================
Deterministic detection of mandatory sections, required headings, and
structural compliance for ISO 27001, ISO 9001, NIST CSF, and GDPR/PDPA.

This layer produces a **Structural Compliance Score** that feeds into the
Compliance Confidence Index (CCI).
"""

import logging
import re
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


# ── Mandatory section mapping tables ─────────────────────────────
# Each framework defines:
#   clause_id → { title, keywords[], mandatory, cia_pillar }

ISO27001_REQUIRED_SECTIONS: List[Dict] = [
    {"clause": "4.1", "title": "Context of the Organization",
     "keywords": ["context", "organization", "organizational context", "internal issues", "external issues"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "4.2", "title": "Interested Parties",
     "keywords": ["interested parties", "stakeholders", "requirements of interested"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "4.3", "title": "Scope of the ISMS",
     "keywords": ["scope", "isms scope", "information security management system scope", "boundaries"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "5.1", "title": "Leadership and Commitment",
     "keywords": ["leadership", "management commitment", "top management", "leadership commitment"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "5.2", "title": "Information Security Policy",
     "keywords": ["information security policy", "security policy", "policy statement"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "5.3", "title": "Roles and Responsibilities",
     "keywords": ["roles", "responsibilities", "security roles", "information security roles"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "6.1.1", "title": "Actions to Address Risks – General",
     "keywords": ["risk", "risks and opportunities", "address risks"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "6.1.2", "title": "Risk Assessment",
     "keywords": ["risk assessment", "risk assessment methodology", "risk criteria",
                   "risk analysis", "risk evaluation", "likelihood", "impact"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "6.1.3", "title": "Risk Treatment",
     "keywords": ["risk treatment", "risk treatment plan", "risk mitigation",
                   "risk acceptance", "risk owner"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "6.2", "title": "Information Security Objectives",
     "keywords": ["security objectives", "information security objectives", "measurable objectives"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.1", "title": "Resources",
     "keywords": ["resources", "resource allocation", "budget"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.2", "title": "Competence",
     "keywords": ["competence", "training", "awareness training", "skill", "qualification"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.3", "title": "Awareness",
     "keywords": ["awareness", "security awareness", "awareness programme"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.5", "title": "Documented Information",
     "keywords": ["documented information", "documentation", "document control", "records"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "8.1", "title": "Operational Planning and Control",
     "keywords": ["operational planning", "operational control"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "8.2", "title": "Risk Assessment Execution",
     "keywords": ["risk assessment", "perform risk assessment", "risk register"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "8.3", "title": "Risk Treatment Execution",
     "keywords": ["risk treatment plan", "implement risk treatment"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "9.1", "title": "Monitoring, Measurement, Analysis",
     "keywords": ["monitoring", "measurement", "analysis", "evaluation", "performance evaluation"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "9.2", "title": "Internal Audit",
     "keywords": ["internal audit", "audit programme", "audit plan"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "9.3", "title": "Management Review",
     "keywords": ["management review", "review output", "review input"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "10.1", "title": "Nonconformity and Corrective Action",
     "keywords": ["nonconformity", "corrective action", "corrective"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "10.2", "title": "Continual Improvement",
     "keywords": ["continual improvement", "continuous improvement", "improvement"],
     "mandatory": True, "cia_pillar": None},
    # Annex A highlight controls
    {"clause": "A.5", "title": "Information Security Policies",
     "keywords": ["information security policies", "policy for information security",
                   "policies for information security"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.6", "title": "Organization of Information Security",
     "keywords": ["organization of information security", "mobile devices", "teleworking"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "A.7", "title": "Human Resource Security",
     "keywords": ["human resource", "screening", "terms of employment",
                   "disciplinary process", "termination"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.8", "title": "Asset Management",
     "keywords": ["asset management", "asset inventory", "acceptable use",
                   "classification", "media handling"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.9", "title": "Access Control",
     "keywords": ["access control", "access policy", "user access management",
                   "authentication", "authorization", "privilege"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.10", "title": "Cryptography",
     "keywords": ["cryptography", "encryption", "cryptographic controls", "key management"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.12", "title": "Operations Security",
     "keywords": ["operations security", "change management", "capacity management",
                   "malware", "backup", "logging", "monitoring"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "A.13", "title": "Communications Security",
     "keywords": ["communications security", "network security", "information transfer",
                   "network controls"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "A.16", "title": "Incident Management",
     "keywords": ["incident management", "incident response", "security incident",
                   "incident reporting", "incident procedure"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "A.17", "title": "Business Continuity",
     "keywords": ["business continuity", "disaster recovery", "continuity plan",
                   "bcp", "drp", "recovery"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "A.18", "title": "Compliance",
     "keywords": ["compliance", "legal requirements", "regulatory", "privacy",
                   "intellectual property"],
     "mandatory": True, "cia_pillar": None},
]

NIST_CSF_REQUIRED_SECTIONS: List[Dict] = [
    {"clause": "GV.OC", "title": "Organizational Context",
     "keywords": ["organizational context", "mission", "stakeholder expectations"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "GV.RM", "title": "Risk Management Strategy",
     "keywords": ["risk management strategy", "risk appetite", "risk tolerance"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "GV.SC", "title": "Supply Chain Risk Management",
     "keywords": ["supply chain", "third party", "vendor risk"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "ID.AM", "title": "Asset Management",
     "keywords": ["asset management", "asset inventory", "hardware", "software inventory"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "ID.RA", "title": "Risk Assessment",
     "keywords": ["risk assessment", "threat", "vulnerability", "likelihood", "impact"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "PR.AA", "title": "Identity Management & Access Control",
     "keywords": ["identity management", "access control", "authentication",
                   "credential", "privilege"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "PR.AT", "title": "Awareness and Training",
     "keywords": ["awareness", "training", "security training"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "PR.DS", "title": "Data Security",
     "keywords": ["data security", "data protection", "encryption", "data at rest",
                   "data in transit"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "PR.PS", "title": "Platform Security",
     "keywords": ["platform security", "configuration", "hardening", "baseline"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "DE.CM", "title": "Continuous Monitoring",
     "keywords": ["continuous monitoring", "monitoring", "detection", "anomaly",
                   "logging", "audit log"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "DE.AE", "title": "Adverse Event Analysis",
     "keywords": ["adverse event", "event analysis", "alert", "indicator"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "RS.MA", "title": "Incident Management",
     "keywords": ["incident management", "incident response", "response plan"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "RS.CO", "title": "Incident Communication",
     "keywords": ["incident communication", "notification", "reporting"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "RC.RP", "title": "Recovery Planning",
     "keywords": ["recovery plan", "disaster recovery", "business continuity",
                   "restoration"],
     "mandatory": True, "cia_pillar": "availability"},
]

GDPR_REQUIRED_SECTIONS: List[Dict] = [
    {"clause": "Art.5", "title": "Principles of Data Processing",
     "keywords": ["lawfulness", "fairness", "transparency", "purpose limitation",
                   "data minimisation", "accuracy", "storage limitation"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.6", "title": "Lawful Basis for Processing",
     "keywords": ["lawful basis", "consent", "legitimate interest", "legal obligation",
                   "contractual necessity"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.13", "title": "Transparency / Privacy Notice",
     "keywords": ["privacy notice", "transparency", "data subject information",
                   "inform data subject"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.15", "title": "Right of Access",
     "keywords": ["right of access", "subject access request", "data access"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "Art.17", "title": "Right to Erasure",
     "keywords": ["right to erasure", "right to be forgotten", "data deletion"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.25", "title": "Data Protection by Design",
     "keywords": ["data protection by design", "privacy by design", "by default"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.30", "title": "Records of Processing",
     "keywords": ["records of processing", "processing register", "processing activities"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "Art.32", "title": "Security of Processing",
     "keywords": ["security of processing", "technical measures", "organisational measures",
                   "pseudonymisation", "encryption"],
     "mandatory": True, "cia_pillar": "confidentiality"},
    {"clause": "Art.33", "title": "Breach Notification to Authority",
     "keywords": ["breach notification", "data breach", "notify authority", "72 hours"],
     "mandatory": True, "cia_pillar": "availability"},
    {"clause": "Art.35", "title": "Data Protection Impact Assessment",
     "keywords": ["data protection impact assessment", "dpia", "impact assessment",
                   "privacy impact"],
     "mandatory": True, "cia_pillar": "integrity"},
    {"clause": "Art.37", "title": "Data Protection Officer",
     "keywords": ["data protection officer", "dpo"],
     "mandatory": True, "cia_pillar": None},
]

ISO9001_REQUIRED_SECTIONS: List[Dict] = [
    {"clause": "4.1", "title": "Context of the Organization",
     "keywords": ["context", "organization context", "internal issues", "external issues"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "5.2", "title": "Quality Policy",
     "keywords": ["quality policy", "policy statement"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "6.1", "title": "Actions to Address Risks",
     "keywords": ["risk", "opportunity", "risk-based thinking"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "6.2", "title": "Quality Objectives",
     "keywords": ["quality objectives", "measurable objectives"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.1", "title": "Resources",
     "keywords": ["resources", "infrastructure", "environment for operation"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "7.2", "title": "Competence",
     "keywords": ["competence", "training", "education", "experience"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "8.1", "title": "Operational Planning and Control",
     "keywords": ["operational planning", "operational control", "process"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "9.1", "title": "Monitoring, Measurement, Analysis",
     "keywords": ["monitoring", "measurement", "analysis", "evaluation"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "9.2", "title": "Internal Audit",
     "keywords": ["internal audit", "audit programme"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "9.3", "title": "Management Review",
     "keywords": ["management review"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "10.2", "title": "Nonconformity and Corrective Action",
     "keywords": ["nonconformity", "corrective action"],
     "mandatory": True, "cia_pillar": None},
    {"clause": "10.3", "title": "Continual Improvement",
     "keywords": ["continual improvement", "continuous improvement"],
     "mandatory": True, "cia_pillar": None},
]

FRAMEWORK_SECTIONS = {
    "iso27001": ISO27001_REQUIRED_SECTIONS,
    "nist": NIST_CSF_REQUIRED_SECTIONS,
    "gdpr": GDPR_REQUIRED_SECTIONS,
    "iso9001": ISO9001_REQUIRED_SECTIONS,
}


class RuleBasedEngine:
    """
    Layer 1  ─  Deterministic Structural Compliance Checker

    For each mandatory clause the engine:
      1. Searches the document text for the clause heading / keywords.
      2. Marks it as Present, Partial, or Missing.
      3. Calculates a Structural Compliance Score (0-100).
    """

    def __init__(self):
        self.framework_sections = FRAMEWORK_SECTIONS

    # ── Public API ────────────────────────────────────────────────
    def analyze(
        self,
        full_text: str,
        clauses: List[Dict],
        framework: str = "iso27001",
    ) -> Dict:
        """
        Run structural compliance check against a single framework.

        Args:
            full_text:  The entire document text (used for heading search).
            clauses:    List of extracted clause dicts (with 'text', 'section').
            framework:  Framework key.

        Returns:
            {
              structural_score, total_required, present, partial, missing,
              section_results: [ {clause, title, status, matched_keywords, cia_pillar} ],
              cia_structural_flags: { confidentiality: [...], integrity: [...], availability: [...] }
            }
        """
        required = self.framework_sections.get(framework, [])
        if not required:
            logger.warning(f"No rule-based mapping for framework '{framework}'")
            return self._empty_result(framework)

        text_lower = full_text.lower()
        all_clause_text = " ".join(c.get("text", "") for c in clauses).lower()
        section_blobs = [
            f"{(c.get('section') or '').lower()} {(c.get('text') or '').lower()}".strip()
            for c in clauses
            if (c.get("text") or "").strip()
        ]

        section_results: List[Dict] = []
        cia_flags = {"confidentiality": [], "integrity": [], "availability": []}
        present = 0
        partial = 0
        missing = 0

        for req in required:
            matched_kw = []
            weighted_hits = 0.0
            search_text = f"{text_lower} {all_clause_text}"

            # Clause/section identifiers in the document are strong structural evidence.
            clause_id = (req.get("clause") or "").lower()
            clause_id_hit = False
            if clause_id:
                clause_id_variants = {
                    clause_id,
                    clause_id.replace(".", " "),
                    clause_id.replace(".", ""),
                }
                clause_id_hit = any(v and v in search_text for v in clause_id_variants)

            for kw in req["keywords"]:
                # Evaluate each keyword against the best local section/paragraph match.
                if section_blobs:
                    hit_score = max(self._keyword_hit_score(blob, kw) for blob in section_blobs)
                else:
                    hit_score = self._keyword_hit_score(search_text, kw)
                if hit_score > 0:
                    matched_kw.append(kw)
                    weighted_hits += hit_score

            ratio = (weighted_hits / len(req["keywords"])) if req["keywords"] else 0

            # Framework-specific thresholds: ISO 9001 clauses are often concise and vary in wording.
            if framework == "iso9001":
                present_threshold = 0.35
                partial_threshold = 0.15
            else:
                present_threshold = 0.55
                partial_threshold = 0.18

            if clause_id_hit:
                ratio = max(ratio, present_threshold)

            if ratio >= present_threshold:
                status = "present"
                present += 1
            elif ratio >= partial_threshold:
                status = "partial"
                partial += 1
            else:
                status = "missing"
                missing += 1

            section_results.append({
                "clause": req["clause"],
                "title": req["title"],
                "status": status,
                "matched_keywords": matched_kw,
                "keyword_coverage": round(ratio * 100, 1),
                "cia_pillar": req.get("cia_pillar"),
            })

            # Track CIA structural gaps
            pillar = req.get("cia_pillar")
            if pillar and status == "missing":
                cia_flags[pillar].append({
                    "clause": req["clause"],
                    "title": req["title"],
                    "impact": f"Missing {req['title']} weakens {pillar.title()} pillar",
                })

        total = len(required)
        structural_score = round(
            ((present * 1.0 + partial * 0.5) / total) * 100, 2
        ) if total else 0

        return {
            "framework": framework,
            "structural_score": structural_score,
            "total_required": total,
            "present": present,
            "partial": partial,
            "missing": missing,
            "section_results": section_results,
            "cia_structural_flags": cia_flags,
        }

    @staticmethod
    def _keyword_hit_score(text: str, keyword: str) -> float:
        """Return weighted keyword match score (0, 0.6, 1.0)."""
        kw = keyword.lower().strip()
        if not kw:
            return 0.0

        if kw in text:
            return 1.0

        # Token-overlap fallback for wording variants.
        tokens = [t for t in re.findall(r"[a-z0-9]+", kw) if len(t) > 2]
        if not tokens:
            return 0.0

        matched_tokens = sum(1 for t in tokens if t in text)
        token_ratio = matched_tokens / len(tokens)
        if token_ratio >= 0.67:
            return 0.6

        return 0.0

    def analyze_multi(
        self,
        full_text: str,
        clauses: List[Dict],
        frameworks: List[str],
    ) -> Dict[str, Dict]:
        """Run structural check for multiple frameworks."""
        return {fw: self.analyze(full_text, clauses, fw) for fw in frameworks}

    # ── Helpers ────────────────────────────────────────────────────
    @staticmethod
    def _empty_result(framework: str) -> Dict:
        return {
            "framework": framework,
            "structural_score": 0,
            "total_required": 0,
            "present": 0,
            "partial": 0,
            "missing": 0,
            "section_results": [],
            "cia_structural_flags": {
                "confidentiality": [],
                "integrity": [],
                "availability": [],
            },
        }


# ── Singleton ─────────────────────────────────────────────────────
rule_engine = RuleBasedEngine()
