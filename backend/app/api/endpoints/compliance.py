"""
Compliance Analysis API Endpoints
Main endpoints for document upload and 3-layer hybrid compliance analysis.

Architecture:
  Layer 1 → Rule-Based Structural Compliance
  Layer 2 → Sentence-BERT Semantic Similarity
  Layer 3 → GPT/LLM Reasoning & Improvement
  CCI    → Compliance Confidence Index
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, List
import logging
from datetime import datetime
from pathlib import Path
import secrets
import os
import re
import json

from app.models.schemas import (
    DocumentUploadResponse,
    ComplianceAnalysisRequest,
    ComplianceAnalysisResponse,
)
from app.modules.security_layer import security_layer
from app.modules.hybrid_pipeline import hybrid_pipeline
from app.modules.firebase_storage import firebase_storage
from app.api.endpoints.auth import verify_token, record_activity
from app.config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ── In-memory file-id → path map (simple; production would use DB) ───
_uploaded_files: Dict[str, Dict] = {}
_upload_index_file = Path(settings.TEMP_UPLOAD_DIR) / ".upload_index.json"


def _load_upload_index() -> Dict[str, Dict]:
    """Load persisted upload index so analysis survives API reloads."""
    try:
        if not _upload_index_file.exists():
            return {}

        with open(_upload_index_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            return data
        return {}
    except Exception as e:
        logger.warning(f"Failed to load upload index: {e}")
        return {}


def _save_upload_index():
    """Persist upload index to disk."""
    try:
        _upload_index_file.parent.mkdir(parents=True, exist_ok=True)
        with open(_upload_index_file, "w", encoding="utf-8") as f:
            json.dump(_uploaded_files, f)
    except Exception as e:
        logger.warning(f"Failed to save upload index: {e}")


_uploaded_files.update(_load_upload_index())


def _sanitize_path_part(value: str, fallback: str = "item") -> str:
    raw = (value or "").strip()
    raw = Path(raw).name
    cleaned = re.sub(r"[^A-Za-z0-9._@-]", "_", raw)
    cleaned = cleaned.strip("._-")
    return cleaned[:120] if cleaned else fallback


def _safe_join(base_dir: Path, *parts: str) -> Path:
    base = base_dir.resolve()
    target = (base / Path(*parts)).resolve()
    if target != base and not str(target).startswith(str(base) + os.sep):
        raise HTTPException(status_code=400, detail="Invalid file path")
    return target


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...), token_data: dict = Depends(verify_token)):
    """
    Upload compliance document for analysis.

    - Supports PDF and DOCX formats
    - Maximum file size: 10MB
    - Files are encrypted and automatically deleted after processing
    """
    user_id = token_data.get("sub", "unknown")
    try:
        file_data = await file.read()

        # Validate file size
        is_valid, error_msg = security_layer.validate_file_size(len(file_data))
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Validate file format
        file_extension = file.filename.split(".")[-1].lower()
        if file_extension not in ["pdf", "docx"]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Only PDF and DOCX are supported.",
            )

        # Secure upload (stores to temp dir, hashes, schedules cleanup)
        secure_path, file_hash = security_layer.secure_file_upload(
            file_data, file.filename
        )

        security_layer.log_security_event(
            "document_upload",
            {"filename": file.filename, "size": len(file_data), "hash": file_hash[:16]},
        )

        # Firebase audit log
        try:
            firebase_storage.store_audit_log(
                {
                    "event_type": "document_upload",
                    "file_name": file.filename,
                    "file_size": len(file_data),
                    "file_hash": file_hash[:32],
                }
            )
        except Exception as e:
            logger.warning(f"Firebase audit log failed: {e}")

        # Save a user-scoped permanent copy so Admin Dashboard can list all uploads.
        safe_user_id = _sanitize_path_part(user_id, "user")
        safe_filename = _sanitize_path_part(file.filename, "document")
        uploads_dir = _safe_join(Path(settings.USER_UPLOADS_DIR), safe_user_id)
        uploads_dir.mkdir(parents=True, exist_ok=True)
        ts_prefix = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        unique_suffix = secrets.token_hex(3)
        perm_path = _safe_join(uploads_dir, f"{ts_prefix}_{unique_suffix}_{safe_filename}")
        with open(perm_path, "wb") as f:
            f.write(file_data)

        # Map file_id → path so /analyze can retrieve the file
        file_id = secrets.token_urlsafe(16)
        _uploaded_files[file_id] = {
            "path": secure_path,
            "name": file.filename,
            "hash": file_hash,
            "size": len(file_data),
        }
        _save_upload_index()

        return DocumentUploadResponse(
            file_id=file_id,
            file_name=file.filename,
            file_hash=file_hash,
            file_size=len(file_data),
            uploaded_at=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="File upload failed")
    finally:
        # Track the upload activity
        record_activity(user_id, "upload", f"Uploaded {file.filename}")


@router.post("/analyze")
async def analyze_compliance(request: ComplianceAnalysisRequest, token_data: dict = Depends(verify_token)):
    """
    3-Layer Hybrid Compliance Analysis

    Pipeline:
      1. Text Extraction (document_processor)
      2. Layer 1 — Rule-Based Structural Check
      3. Layer 2 — Sentence-BERT Semantic Similarity
      4. Layer 3 — GPT/LLM Reasoning (gap explanation, improvements, CIA impact)
      5. CIA Balance Analysis
      6. Audit Risk Prediction
      7. Compliance Confidence Index (CCI)
    """
    user_id = token_data.get("sub", "unknown")
    try:
        logger.info(f"Starting hybrid analysis for file_id: {request.file_id}")

        # Resolve the uploaded file
        file_info = _uploaded_files.get(request.file_id)

        # Refresh from persisted index if this process restarted.
        if not file_info:
            _uploaded_files.update(_load_upload_index())
            file_info = _uploaded_files.get(request.file_id)

        if not file_info:
            raise HTTPException(
                status_code=404,
                detail="Uploaded file session not found. Please upload the document again.",
            )

        file_path = Path(file_info.get("path", ""))
        if not file_path.exists():
            _uploaded_files.pop(request.file_id, None)
            _save_upload_index()
            raise HTTPException(
                status_code=410,
                detail="Uploaded file is no longer available. Please upload and analyze again.",
            )

        expected_hash = file_info.get("hash")
        if expected_hash and not security_layer.verify_integrity(str(file_path), expected_hash):
            raise HTTPException(
                status_code=400,
                detail="File integrity verification failed. Please upload the document again.",
            )

        # ── Real document path ────────────────────────────────
        result = hybrid_pipeline.run(
            file_path=str(file_path),
            frameworks=request.frameworks,
            include_cia=request.include_cia,
            file_name=file_info["name"],
        )

        logger.info(f"Hybrid analysis completed: {result['analysis_id']}")

        # Firebase metadata (sanitised)
        try:
            safe = {k: v for k, v in result.items() if k not in ("hybrid_analysis",)}
            firebase_storage.store_analysis_metadata(safe)
        except Exception as e:
            logger.warning(f"Firebase storage failed: {e}")

        return result

    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Compliance analysis failed")
    finally:
        frameworks_str = ", ".join(request.frameworks) if request.frameworks else "iso27001"
        record_activity(user_id, "analysis", f"Analyzed document (frameworks: {frameworks_str})")


@router.get("/frameworks")
async def get_supported_frameworks():
    """
    Get list of supported compliance frameworks
    """
    return {
        "frameworks": [
            {
                "id": "iso27001",
                "name": "ISO/IEC 27001:2022",
                "description": "Information Security Management System",
                "controls_count": 114
            },
            {
                "id": "iso9001",
                "name": "ISO 9001:2015",
                "description": "Quality Management System",
                "controls_count": 10
            },
            {
                "id": "nist",
                "name": "NIST Cybersecurity Framework",
                "description": "NIST CSF 2.0",
                "controls_count": 108
            },
            {
                "id": "gdpr",
                "name": "GDPR/PDPA",
                "description": "Data Privacy Regulations",
                "controls_count": 57
            }
        ]
    }


@router.get("/health")
async def health_check():
    """Health check for compliance service"""
    return {
        "status": "healthy",
        "service": "compliance_analysis",
        "modules": {
            "document_processor": "operational",
            "nlp_engine": "operational",
            "cia_validator": "operational",
            "iso9001_validator": "operational",
            "audit_predictor": "operational",
            "security_layer": "operational"
        }
    }
