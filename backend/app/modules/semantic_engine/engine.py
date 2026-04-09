"""
Layer 2  ─  Sentence-BERT Semantic Similarity Engine
=====================================================
Converts ISO / NIST / GDPR clauses *and* uploaded-document paragraphs into
embeddings using ``sentence-transformers/all-MiniLM-L6-v2``, then computes
cosine similarity to grade compliance at three levels:

  ≥ 0.85  → Strong compliance
  0.60–0.85 → Partial compliance
  < 0.60  → Weak / missing

This layer produces a **Semantic Compliance Score** for the CCI formula.
"""

import logging
from typing import Dict, List, Optional
import numpy as np
import json
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Thresholds
STRONG_THRESHOLD = 0.66
PARTIAL_THRESHOLD = 0.46


class SemanticSimilarityEngine:
    """
    Wrapper around SentenceTransformer that:
      1. Loads framework control descriptions once.
      2. Encodes user document clauses on demand.
      3. Returns per-clause similarity scores + aggregate Semantic Score.
    """

    def __init__(self):
        self.model_name = "sentence-transformers/all-MiniLM-L6-v2"
        self._model = None
        self._device = "cpu"
        self._framework_embeddings: Dict[str, np.ndarray] = {}
        self._framework_controls: Dict[str, List[Dict]] = {}
        self._load_frameworks()

    # ── Model loading (lazy) ──────────────────────────────────────
    def _ensure_model(self):
        if self._model is not None:
            return
        try:
            import torch
            self._device = "cuda" if settings.USE_GPU and torch.cuda.is_available() else "cpu"
        except ImportError:
            self._device = "cpu"
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading Sentence-BERT model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name, device=self._device)
            logger.info("Sentence-BERT model loaded")
        except Exception as e:
            logger.error(f"Failed to load Sentence-BERT: {e}")
            self._model = None

    # ── Framework data ────────────────────────────────────────────
    def _load_frameworks(self):
        fdir = Path(settings.FRAMEWORKS_DATA_DIR)
        mapping = {
            "iso27001": "iso27001_controls.json",
            "iso9001": "iso9001_requirements.json",
            "nist": "nist_csf.json",
            "gdpr": "pdpa_gdpr.json",
        }
        for fw, fname in mapping.items():
            fpath = fdir / fname
            if fpath.exists():
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._framework_controls[fw] = data.get("controls", [])

    def _get_control_embeddings(self, framework: str) -> np.ndarray:
        """Encode all control descriptions for a framework (cached)."""
        if framework in self._framework_embeddings:
            return self._framework_embeddings[framework]
        self._ensure_model()
        if self._model is None:
            return np.array([])
        controls = self._framework_controls.get(framework, [])
        texts = [c.get("description", c.get("title", "")) for c in controls]
        if not texts:
            return np.array([])
        embeddings = self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        self._framework_embeddings[framework] = embeddings
        return embeddings

    # ── Public API ────────────────────────────────────────────────
    def analyze(
        self,
        clauses: List[Dict],
        framework: str = "iso27001",
    ) -> Dict:
        """
        Semantic analysis of document clauses against a framework.

        Returns:
            {
              semantic_score,  # 0-100
              strong_count, partial_count, weak_count,
              clause_matches: [
                {
                  clause_text, best_control_id, best_control_title,
                  similarity, compliance_level
                }
              ],
              control_coverage: {control_id: max_similarity},
              missing_controls: [{control_id, title, category, priority}],
            }
        """
        self._ensure_model()

        controls = self._framework_controls.get(framework, [])
        control_embeddings = self._get_control_embeddings(framework)

        # Fallback when model not available
        if self._model is None or len(control_embeddings) == 0:
            return self._fallback_analysis(clauses, framework)

        clause_texts = []
        for c in clauses:
            text = (c.get("text", "") or "").strip()
            # Ignore extremely short/noisy fragments that degrade similarity quality.
            if len(text) < 30 or len(text.split()) < 5:
                continue
            clause_texts.append(text)

        if not clause_texts:
            return self._empty_result(framework)

        relevance = self._framework_relevance(" ".join(clause_texts), framework)
        dynamic_strong = min(0.85, STRONG_THRESHOLD + (1.0 - relevance) * 0.05)
        dynamic_partial = min(0.68, PARTIAL_THRESHOLD + (1.0 - relevance) * 0.06)

        # Encode document clauses
        clause_embeddings = self._model.encode(
            clause_texts, convert_to_numpy=True, show_progress_bar=False
        )

        from sklearn.metrics.pairwise import cosine_similarity as cos_sim

        # similarity_matrix: (n_clauses × n_controls)
        sim_matrix = cos_sim(clause_embeddings, control_embeddings)

        # Per-clause best match
        clause_matches = []
        strong = partial = weak = 0
        for i, ctext in enumerate(clause_texts):
            best_idx = int(np.argmax(sim_matrix[i]))
            best_sim = float(sim_matrix[i][best_idx])
            ctrl = controls[best_idx]

            if best_sim >= dynamic_strong:
                level = "strong"
                strong += 1
            elif best_sim >= dynamic_partial:
                level = "partial"
                partial += 1
            else:
                level = "weak"
                weak += 1

            clause_matches.append({
                "clause_text": ctext[:120],
                "best_control_id": ctrl.get("id", "?"),
                "best_control_title": ctrl.get("title", "?"),
                "similarity": round(best_sim, 4),
                "compliance_level": level,
            })

        # Per-control max coverage
        control_max = np.max(sim_matrix, axis=0)  # shape (n_controls,)
        control_coverage = {}
        matched_ids = set()
        for j, ctrl in enumerate(controls):
            cid = ctrl.get("id", f"ctrl_{j}")
            score = float(control_max[j])
            control_coverage[cid] = round(score, 4)
            if score >= dynamic_partial:
                matched_ids.add(cid)

        # Missing controls
        missing_controls = [
            {
                "control_id": ctrl.get("id", "?"),
                "title": ctrl.get("title", "?"),
                "category": ctrl.get("category", "General"),
                "priority": ctrl.get("priority", "Medium"),
            }
            for j, ctrl in enumerate(controls)
            if ctrl.get("id", f"ctrl_{j}") not in matched_ids
        ]

        total = len(clause_texts)

        # Blend clause-level quality and control-level coverage for a more stable score.
        clause_quality = ((strong * 1.0 + partial * 0.5) / total) * 100 if total else 0
        control_coverage_pct_raw = (len(matched_ids) / len(controls) * 100) if controls else 0
        relevance_weight = 0.75 + (0.25 * relevance)
        control_coverage_pct = control_coverage_pct_raw * relevance_weight
        semantic_score = round(((clause_quality * 0.45) + (control_coverage_pct * 0.55)) * (0.85 + (0.15 * relevance)), 2)

        return {
            "framework": framework,
            "semantic_score": semantic_score,
            "strong_count": strong,
            "partial_count": partial,
            "weak_count": weak,
            "total_clauses": total,
            "matched_controls": len(matched_ids),
            "total_controls": len(controls),
            "compliance_percentage": round(control_coverage_pct, 2),
            "framework_relevance": round(relevance * 100, 2),
            "clause_matches": clause_matches,
            "control_coverage": control_coverage,
            "missing_controls": missing_controls,
        }

    @staticmethod
    def _framework_relevance(text: str, framework: str) -> float:
        """Estimate whether document language fits selected framework to avoid cross-mapping inflation."""
        lexicons = {
            "iso9001": ["quality", "qms", "customer", "nonconformity", "corrective action", "management review", "continual improvement"],
            "iso27001": ["information security", "isms", "access control", "confidentiality", "integrity", "availability", "incident", "cryptography"],
            "nist": ["cybersecurity", "identify", "protect", "detect", "respond", "recover", "nist"],
            "gdpr": ["personal data", "data subject", "lawful basis", "consent", "controller", "processor", "privacy", "breach"],
        }
        terms = lexicons.get(framework, [])
        if not terms:
            return 1.0

        lower = text.lower()
        hits = sum(1 for t in terms if t in lower)
        ratio = hits / len(terms)

        # Keep a floor to avoid over-penalizing valid edge cases.
        return max(0.55, min(1.0, 0.55 + ratio * 0.45))

    def analyze_multi(
        self,
        clauses: List[Dict],
        frameworks: List[str],
    ) -> Dict[str, Dict]:
        """Run semantic analysis for multiple frameworks."""
        return {fw: self.analyze(clauses, fw) for fw in frameworks}

    # ── Fallback (no model) ───────────────────────────────────────
    def _fallback_analysis(self, clauses: List[Dict], framework: str) -> Dict:
        """Keyword-overlap fallback when sentence-transformers is unavailable."""
        controls = self._framework_controls.get(framework, [])
        all_text = " ".join(c.get("text", "") for c in clauses).lower()

        matched_ids = set()
        for ctrl in controls:
            desc = ctrl.get("description", ctrl.get("title", "")).lower()
            keywords = desc.split()[:6]
            if any(kw in all_text for kw in keywords if len(kw) > 3):
                matched_ids.add(ctrl.get("id", ""))

        missing = [
            {
                "control_id": ctrl.get("id", "?"),
                "title": ctrl.get("title", "?"),
                "category": ctrl.get("category", "General"),
                "priority": ctrl.get("priority", "Medium"),
            }
            for ctrl in controls
            if ctrl.get("id", "") not in matched_ids
        ]

        total = len(clauses) or 1
        score = round(len(matched_ids) / (len(controls) or 1) * 100, 2)
        return {
            "framework": framework,
            "semantic_score": score,
            "strong_count": 0,
            "partial_count": len(matched_ids),
            "weak_count": total - len(matched_ids),
            "total_clauses": total,
            "matched_controls": len(matched_ids),
            "total_controls": len(controls),
            "compliance_percentage": score,
            "clause_matches": [],
            "control_coverage": {},
            "missing_controls": missing,
            "note": "Fallback keyword analysis (Sentence-BERT unavailable)",
        }

    @staticmethod
    def _empty_result(framework: str) -> Dict:
        return {
            "framework": framework,
            "semantic_score": 0,
            "strong_count": 0,
            "partial_count": 0,
            "weak_count": 0,
            "total_clauses": 0,
            "matched_controls": 0,
            "total_controls": 0,
            "compliance_percentage": 0,
            "clause_matches": [],
            "control_coverage": {},
            "missing_controls": [],
        }


# ── Lazy singleton ────────────────────────────────────────────────
_instance: Optional[SemanticSimilarityEngine] = None


def _get():
    global _instance
    if _instance is None:
        _instance = SemanticSimilarityEngine()
    return _instance


class _Lazy:
    def __getattr__(self, name):
        return getattr(_get(), name)


semantic_engine = _Lazy()
