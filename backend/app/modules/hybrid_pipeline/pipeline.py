"""
Hybrid Compliance Pipeline  ─  3-Layer Orchestrator
=====================================================

Complete workflow:

  User Upload
    → Text Extraction  (document_processor)
    → Layer 1: Rule-Based Structural Check  (rule_engine)
    → Layer 2: Sentence-BERT Semantic Matching  (semantic_engine)
    → Layer 3: GPT/LLM Reasoning  (reasoning_engine)
    → CIA Analysis  (cia_validator)
    → Audit Risk Prediction  (audit_predictor)
    → Compliance Confidence Index (CCI)
    → Final Output

CCI Formula:
  CCI = (Structural Score × 0.4) + (Semantic Score × 0.4) + (AI Reasoning Confidence × 0.2)
"""

import logging
import secrets
from datetime import datetime
from typing import Dict, List, Optional

from app.modules.rule_engine import rule_engine
from app.modules.semantic_engine import semantic_engine
from app.modules.reasoning_engine import reasoning_engine
from app.modules.cia_validator import cia_validator
from app.modules.audit_predictor import audit_predictor
from app.modules.document_processor import document_processor

logger = logging.getLogger(__name__)


class HybridCompliancePipeline:
    """
    Orchestrates the 3-layer hybrid analysis and produces the final
    Compliance Confidence Index (CCI).
    """

    CCI_WEIGHTS = {
        "structural": 0.4,
        "semantic": 0.4,
        "reasoning": 0.2,
    }

    # ── Main entry point ──────────────────────────────────────────
    def run(
        self,
        file_path: Optional[str] = None,
        clauses: Optional[List[Dict]] = None,
        full_text: Optional[str] = None,
        frameworks: List[str] = None,
        include_cia: bool = True,
        file_name: str = "document",
    ) -> Dict:
        """
        Execute the full hybrid compliance pipeline.

        Provide either ``file_path`` (will extract text) or
        ``clauses`` + ``full_text`` directly.

        Returns the complete analysis response dict.
        """
        if frameworks is None:
            frameworks = ["iso27001"]

        security_frameworks = {"iso27001", "nist", "gdpr"}
        include_cia_effective = include_cia and any(fw in security_frameworks for fw in frameworks)

        # ── Step 1: Text Extraction ───────────────────────────────
        if file_path:
            logger.info(f"Processing document: {file_path}")
            doc_data = document_processor.process_document(file_path)
            clauses = doc_data.get("clauses", [])
            full_text = doc_data.get("full_text", "")
            file_name = doc_data.get("metadata", {}).get("file_name", file_name)
            logger.info(f"Extracted {len(clauses)} clauses, {len(full_text)} chars")
        else:
            if clauses is None:
                clauses = []
            if full_text is None:
                full_text = " ".join(c.get("text", "") for c in clauses)

        # ── Step 2-4: Per-framework 3-layer analysis ──────────────
        layer1_results: Dict[str, Dict] = {}
        layer2_results: Dict[str, Dict] = {}
        layer3_results: Dict[str, Dict] = {}
        cci_scores: Dict[str, float] = {}

        for fw in frameworks:
            logger.info(f"── Analyzing framework: {fw} ──")

            # Layer 1: Rule-Based
            l1 = rule_engine.analyze(full_text, clauses, fw)
            layer1_results[fw] = l1
            logger.info(f"  Layer 1 structural score: {l1['structural_score']}")

            # Layer 2: Semantic Similarity
            l2 = semantic_engine.analyze(clauses, fw)
            layer2_results[fw] = l2
            logger.info(f"  Layer 2 semantic score: {l2['semantic_score']}")

            # Layer 3: Reasoning (needs L1 + L2 outputs)
            cia_data = None
            if include_cia_effective:
                cia_data = cia_validator.analyze_document_cia(clauses)

            l3 = reasoning_engine.analyze(l1, l2, cia_data, fw)
            layer3_results[fw] = l3
            logger.info(f"  Layer 3 reasoning confidence: {l3['reasoning_confidence']}")

            # CCI calculation
            cci = self._compute_cci(
                l1["structural_score"],
                l2["semantic_score"],
                l3["reasoning_confidence"],
            )
            cci_scores[fw] = cci
            logger.info(f"  CCI: {cci}")

        # ── Step 5: CIA Analysis (cross-framework) ────────────────
        cia_analysis = None
        if include_cia_effective:
            cia_analysis = cia_validator.analyze_document_cia(clauses)

        # ── Step 6: Audit Risk Prediction ─────────────────────────
        primary_fw = frameworks[0]
        risk_input = {
            "missing_controls_count": layer2_results[primary_fw].get("total_controls", 100)
                                     - layer2_results[primary_fw].get("matched_controls", 0),
            "total_controls": layer2_results[primary_fw].get("total_controls", 0),
            "cia_balance_index": cia_analysis.get("cia_balance_index") if cia_analysis else None,
            "weak_clauses": [
                m for m in layer2_results[primary_fw].get("clause_matches", [])
                if m.get("compliance_level") == "weak"
            ],
            "total_clauses": len(clauses),
            "compliance_percentage": layer2_results[primary_fw].get("compliance_percentage", 0),
            "structural_score": layer1_results[primary_fw].get("structural_score", 0),
            "framework": primary_fw,
            "missing_critical_count": sum(
                1 for mc in layer2_results[primary_fw].get("missing_controls", [])
                if str(mc.get("priority", "")).lower() in {"critical", "high"}
            ),
        }
        risk_prediction = audit_predictor.predict_risk(risk_input)
        audit_readiness = audit_predictor.get_audit_readiness_score(risk_prediction, risk_input)

        # ── Step 7: Build legacy-compatible compliance_results ────
        compliance_results = {}
        for fw in frameworks:
            l2 = layer2_results[fw]
            compliance_results[fw] = {
                "compliance_percentage": l2.get("compliance_percentage", 0),
                "matched_controls_count": l2.get("matched_controls", 0),
                "total_controls": l2.get("total_controls", 0),
                "total_clauses": l2.get("total_clauses", 0),
                "matched_clauses": l2.get("strong_count", 0) + l2.get("partial_count", 0),
                "missing_controls": l2.get("missing_controls", [])[:10],
                "weak_clauses": [
                    {"clause": m["clause_text"], "reason": f"Low similarity ({m['similarity']:.2f})"}
                    for m in l2.get("clause_matches", [])
                    if m.get("compliance_level") == "weak"
                ][:5],
            }

        # ── Assemble final response ───────────────────────────────
        analysis_id = secrets.token_urlsafe(16)

        return {
            "analysis_id": analysis_id,
            "file_name": file_name,
            "frameworks": frameworks,

            # Legacy fields (backward-compatible with existing frontend)
            "compliance_results": compliance_results,
            "cia_analysis": cia_analysis,
            "risk_prediction": risk_prediction,
            "audit_readiness": audit_readiness,

            # ── NEW: 3-Layer Hybrid Architecture ──────────────────
            "hybrid_analysis": {
                "layer1_structural": layer1_results,
                "layer2_semantic": layer2_results,
                "layer3_reasoning": layer3_results,
                "cci_scores": cci_scores,
                "overall_cci": round(
                    sum(cci_scores.values()) / len(cci_scores), 2
                ) if cci_scores else 0,
            },

            "analyzed_at": datetime.utcnow().isoformat(),
        }

    # ── CCI Calculation ───────────────────────────────────────────
    def _compute_cci(
        self,
        structural_score: float,
        semantic_score: float,
        reasoning_confidence: float,
    ) -> float:
        """
        Compliance Confidence Index:
        CCI = (Structural × 0.4) + (Semantic × 0.4) + (Reasoning × 0.2)
        """
        cci = (
            structural_score * self.CCI_WEIGHTS["structural"]
            + semantic_score * self.CCI_WEIGHTS["semantic"]
            + reasoning_confidence * self.CCI_WEIGHTS["reasoning"]
        )
        return round(cci, 2)


# ── Singleton ─────────────────────────────────────────────────────
hybrid_pipeline = HybridCompliancePipeline()
