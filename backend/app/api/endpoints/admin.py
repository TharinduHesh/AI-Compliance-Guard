"""
Admin API Endpoints
User management (add/list/delete) + system administration
Only the admin account can access these endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import os
from pathlib import Path
import re

from app.api.endpoints.auth import (
    verify_admin, verify_token,
    _users, get_user,
    _fb_set_user, _fb_delete_user, _fb_list_users,
    _activity_log, record_activity,
)
from app.modules.security_layer import security_layer
from app.modules.firebase_storage import firebase_storage
from app.config.settings import settings

from jose import jwt, JWTError

logger = logging.getLogger(__name__)
router = APIRouter()


ALLOWED_RETENTION_PERIODS = {"week", "month", "three_months"}
_auto_delete_config = {
    "history_period": "month",
}


def _extract_chat_query(detail: str) -> str:
    raw = (detail or "").strip()
    if raw.lower().startswith("chat message:"):
        return raw.split(":", 1)[1].strip()
    return raw


def _normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip().lower())


def _is_term_in_query(query: str, term: str) -> bool:
    if not term:
        return False
    normalized_query = _normalize_query(query)
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", normalized_query)
    return term.lower() in words


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


# ── Schemas ──────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    company_id: str = Field(..., min_length=3, max_length=50)
    company_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6)
    role: str = Field(default="user", pattern="^(user|admin)$")


class UserOut(BaseModel):
    company_id: str
    company_name: str
    role: str = "user"
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class AutoDeleteConfigRequest(BaseModel):
    history_period: str = Field(..., pattern="^(week|month|three_months)$")


class ChatTrackerDeleteRequest(BaseModel):
    target_type: str = Field(..., pattern="^(top_user|search_term|search_query)$")
    value: Optional[str] = None
    delete_all: bool = False


# ── User Management (Admin only) ────────────────────────────
@router.get("/users", response_model=List[UserOut])
async def list_users(token_data: dict = Depends(verify_admin)):
    """List all registered users (admin only)"""
    users = []
    for cid, u in _users.items():
        users.append(UserOut(
            company_id=cid,
            company_name=u.get("company_name", ""),
            role=u.get("role", "user"),
            created_at=u.get("created_at"),
            last_login=u.get("last_login"),
        ))
    return users


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: CreateUserRequest, token_data: dict = Depends(verify_admin)):
    """Create a new user account (admin only). Saved to Firebase + memory."""
    cid = body.company_id.strip()

    if cid.lower() in (k.lower() for k in _users):
        raise HTTPException(status_code=409, detail="Company ID already exists")

    user_data = {
        "company_name": body.company_name.strip(),
        "password": body.password,
        "role": body.role,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Save to memory
    _users[cid] = user_data
    # Persist to Firebase
    _fb_set_user(cid, user_data)

    logger.info(f"Admin created user: {cid} (role={body.role})")
    record_activity(token_data.get("sub", "admin"), "create_user", f"Created user '{cid}' (role={body.role})")
    return UserOut(
        company_id=cid,
        company_name=user_data["company_name"],
        role=user_data["role"],
        created_at=user_data["created_at"],
    )


@router.delete("/users/{company_id}")
async def delete_user(company_id: str, token_data: dict = Depends(verify_admin)):
    """Delete a user account (admin only). Cannot delete the admin itself."""
    from app.api.endpoints.auth import ADMIN_EMAIL
    if company_id == ADMIN_EMAIL:
        raise HTTPException(status_code=400, detail="Cannot delete the admin account")

    if company_id not in _users:
        raise HTTPException(status_code=404, detail="User not found")

    del _users[company_id]
    _fb_delete_user(company_id)

    logger.info(f"Admin deleted user: {company_id}")
    record_activity(token_data.get("sub", "admin"), "delete_user", f"Deleted user '{company_id}'")
    return {"message": f"User '{company_id}' deleted successfully"}


@router.get("/activities")
async def list_activities(
    user: Optional[str] = None,
    limit: int = 100,
    token_data: dict = Depends(verify_admin),
):
    """List recent user activities. Optionally filter by user company_id."""
    logs = _activity_log
    if user:
        logs = [a for a in logs if a.get("user") == user]
    return logs[:limit]


@router.get("/history")
async def admin_history(
    category: Optional[str] = None,
    user: Optional[str] = None,
    limit: int = 200,
    token_data: dict = Depends(verify_admin),
):
    """
    Return upload-document and chat history for all users.
    category: 'upload' | 'chat' | None (both)
    """
    allowed = set()
    if category == "upload":
        allowed = {"upload", "analysis"}
    elif category == "chat":
        allowed = {"chat"}
    else:
        allowed = {"upload", "analysis", "chat"}

    logs = _activity_log
    if user:
        logs = [a for a in logs if a.get("user") == user]
    results = [a for a in logs if a.get("action") in allowed]

    # Enrich with company_name from _users
    enriched = []
    for entry in results[:limit]:
        uid = entry.get("user", "")
        udata = _users.get(uid, {})
        enriched.append({
            **entry,
            "company_name": udata.get("company_name", uid),
            "role": udata.get("role", "user"),
        })
    return enriched


# ── User Documents — admin can view all user uploads & analyses ──
@router.get("/user-documents")
async def list_user_documents(
    user: Optional[str] = None,
    limit: int = 200,
    token_data: dict = Depends(verify_admin),
):
    """
    Return all document upload and analysis activities for every user.
    Admin can filter by a specific user company_id.
    Each entry includes user, filename, frameworks, timestamp, and status.
    """
    # Gather upload & analysis records from activity log
    upload_map = {}   # keyed by "user|detail" to de-dup
    for entry in _activity_log:
        uid = entry.get("user", "")
        action = entry.get("action", "")
        if action not in ("upload", "analysis"):
            continue
        if user and uid != user:
            continue

        detail = entry.get("detail", "")
        ts = entry.get("timestamp", "")
        udata = _users.get(uid, {})

        if action == "upload":
            filename = detail.replace("Uploaded ", "") if detail.startswith("Uploaded ") else detail
            key = f"{uid}|{filename}|upload"
            if key not in upload_map:
                upload_map[key] = {
                    "user": uid,
                    "company_name": udata.get("company_name", uid),
                    "role": udata.get("role", "user"),
                    "action": "upload",
                    "filename": filename,
                    "frameworks": [],
                    "timestamp": ts,
                }
        elif action == "analysis":
            # Extract frameworks from detail like "Analyzed document (frameworks: iso27001, nist)"
            frameworks = []
            if "frameworks:" in detail:
                fw_str = detail.split("frameworks:")[-1].strip().rstrip(")")
                frameworks = [f.strip() for f in fw_str.split(",") if f.strip()]
            key = f"{uid}|analysis|{ts}"
            upload_map[key] = {
                "user": uid,
                "company_name": udata.get("company_name", uid),
                "role": udata.get("role", "user"),
                "action": "analysis",
                "filename": detail,
                "frameworks": frameworks,
                "timestamp": ts,
            }

    docs = sorted(upload_map.values(), key=lambda d: d.get("timestamp", ""), reverse=True)
    return docs[:limit]


# ── User Uploaded Files — admin can browse actual files on disk ──
@router.get("/user-files")
async def list_user_files(
    user: Optional[str] = None,
    token_data: dict = Depends(verify_admin),
):
    """
    Return a listing of all uploaded files stored on disk,
    grouped by user.
    """
    uploads_root = Path(settings.USER_UPLOADS_DIR)
    result = []

    if not uploads_root.exists():
        return result

    for user_dir in sorted(uploads_root.iterdir()):
        if not user_dir.is_dir():
            continue
        uid = user_dir.name
        if user and uid != user:
            continue
        udata = _users.get(uid, {})

        for fpath in sorted(user_dir.iterdir(), reverse=True):
            if fpath.is_file():
                stat = fpath.stat()
                # filename on disk: 20260228_193000_report.pdf
                orig_name = "_".join(fpath.name.split("_")[2:]) if fpath.name.count("_") >= 2 else fpath.name
                result.append({
                    "user": uid,
                    "company_name": udata.get("company_name", uid),
                    "filename": orig_name,
                    "stored_name": fpath.name,
                    "size_bytes": stat.st_size,
                    "uploaded_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
                })

    return result


@router.get("/user-files/download")
async def download_user_file(
    user: str = "",
    filename: str = "",
    token: str = "",
):
    """
    Download a specific user's uploaded file.
    Accepts JWT token as a query param (for direct browser downloads).
    """
    # Verify admin via query-param token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user or not filename:
        raise HTTPException(status_code=400, detail="user and filename are required")

    safe_user = _sanitize_path_part(user, "user")
    safe_filename = _sanitize_path_part(filename, "file")
    uploads_root = Path(settings.USER_UPLOADS_DIR)
    file_path = _safe_join(uploads_root, safe_user, safe_filename)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type
    ext = file_path.suffix.lower()
    media_type = "application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=safe_filename,
    )


# ── System endpoints (unchanged) ────────────────────────────
@router.get("/stats")
async def get_system_stats(token_data: dict = Depends(verify_admin)):
    """Get system statistics"""
    return {
        "total_analyses": 0,
        "active_users": len(_users),
        "frameworks_supported": 4,
        "models_loaded": 7,
    }


@router.post("/cleanup")
async def cleanup_temp_files(token_data: dict = Depends(verify_admin)):
    """Cleanup temporary files"""
    try:
        cleaned_count = security_layer.cleanup_temp_files()
        return {"message": f"Cleaned up {cleaned_count} temporary files", "count": cleaned_count}
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Cleanup failed")


@router.get("/system-health")
async def get_system_health(token_data: dict = Depends(verify_admin)):
    """Get detailed system health status"""
    firebase_stats = firebase_storage.get_storage_stats()
    return {
        "status": "healthy",
        "modules": {
            "document_processor": "operational",
            "nlp_engine": "operational",
            "cia_validator": "operational",
            "iso9001_validator": "operational",
            "knowledge_graph": "operational",
            "audit_predictor": "operational",
            "security_layer": "operational",
            "firebase_storage": "operational" if firebase_stats.get("enabled") else "disabled",
        },
        "firebase": firebase_stats,
        "disk_usage": "low",
        "memory_usage": "normal",
    }


@router.get("/firebase-stats")
async def get_firebase_stats(token_data: dict = Depends(verify_admin)):
    """Get Firebase storage statistics"""
    try:
        stats = firebase_storage.get_storage_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get Firebase stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve Firebase stats")


@router.post("/firebase-cleanup")
async def cleanup_firebase_metadata(token_data: dict = Depends(verify_admin)):
    """Clean up expired metadata from Firebase"""
    try:
        deleted_count = firebase_storage.cleanup_expired_metadata()
        return {"message": f"Cleaned up {deleted_count} expired metadata entries", "count": deleted_count}
    except Exception as e:
        logger.error(f"Firebase cleanup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Firebase cleanup failed")


@router.get("/auto-delete-settings")
async def get_auto_delete_settings(token_data: dict = Depends(verify_admin)):
    """Get current admin-configured auto-delete settings."""
    return dict(_auto_delete_config)


@router.put("/auto-delete-settings")
async def update_auto_delete_settings(
    body: AutoDeleteConfigRequest,
    token_data: dict = Depends(verify_admin),
):
    """Update admin-configured auto-delete period for history cleanup."""
    if body.history_period not in ALLOWED_RETENTION_PERIODS:
        raise HTTPException(status_code=400, detail="Invalid period. Use: week, month, or three_months")

    _auto_delete_config["history_period"] = body.history_period
    record_activity(
        token_data.get("sub", "admin"),
        "update_auto_delete",
        f"Updated auto-delete period to {body.history_period}",
    )
    return {
        "message": "Auto-delete settings updated",
        "history_period": body.history_period,
    }


# ── Advanced Analytics ───────────────────────────────────────
@router.get("/analytics")
async def get_analytics(token_data: dict = Depends(verify_admin)):
    """
    Return advanced user engagement analytics:
    - Per-user activity breakdown (logins, uploads, analyses, chats, total)
    - Overall task-type totals
    - Most/least active users
    """
    from app.api.endpoints.auth import _activity_log, _users

    # Aggregate per-user counts
    user_stats: dict = {}
    task_totals = {"login": 0, "upload": 0, "analysis": 0, "chat": 0, "other": 0}

    for entry in _activity_log:
        uid = entry.get("user", "unknown")
        action = entry.get("action", "other")

        if uid not in user_stats:
            udata = _users.get(uid, {})
            user_stats[uid] = {
                "user": uid,
                "company_name": udata.get("company_name", uid),
                "role": udata.get("role", "user"),
                "last_login": udata.get("last_login"),
                "logins": 0,
                "uploads": 0,
                "analyses": 0,
                "chats": 0,
                "total": 0,
            }

        user_stats[uid]["total"] += 1
        if action == "login":
            user_stats[uid]["logins"] += 1
            task_totals["login"] += 1
        elif action == "upload":
            user_stats[uid]["uploads"] += 1
            task_totals["upload"] += 1
        elif action == "analysis":
            user_stats[uid]["analyses"] += 1
            task_totals["analysis"] += 1
        elif action == "chat":
            user_stats[uid]["chats"] += 1
            task_totals["chat"] += 1
        else:
            task_totals["other"] += 1

    # Rank users by total activity
    ranked = sorted(user_stats.values(), key=lambda u: u["total"], reverse=True)

    # Chat tracker: who uses chat the most and what they mostly search.
    chat_user_counts: dict = {}
    query_counts: dict = {}
    term_counts: dict = {}

    stop_words = {
        "the", "and", "for", "that", "with", "this", "from", "your", "you", "are", "was", "were",
        "have", "has", "had", "can", "could", "would", "should", "about", "what", "when", "where",
        "which", "who", "why", "how", "not", "but", "all", "any", "our", "their", "they", "them",
        "please", "help", "need", "want", "into", "than", "then", "also", "here", "there", "document",
        "compliance", "chat", "message", "messages", "analyze", "analysis", "uploaded", "upload"
    }

    for entry in _activity_log:
        if entry.get("action") != "chat":
            continue

        uid = entry.get("user", "unknown")
        detail = (entry.get("detail") or "").strip()

        chat_user_counts[uid] = chat_user_counts.get(uid, 0) + 1

        if detail.lower().startswith("chat message:"):
            query = detail.split(":", 1)[1].strip()
        else:
            query = detail

        if query:
            normalized_query = re.sub(r"\s+", " ", query).strip().lower()
            query_counts[normalized_query] = query_counts.get(normalized_query, 0) + 1

            words = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", normalized_query)
            for w in words:
                if w in stop_words or w.isdigit():
                    continue
                term_counts[w] = term_counts.get(w, 0) + 1

    top_chat_users = sorted(chat_user_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_queries = sorted(query_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_terms = sorted(term_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    top_chat_users_enriched = []
    for uid, chats in top_chat_users:
        udata = _users.get(uid, {})
        top_chat_users_enriched.append({
            "user": uid,
            "company_name": udata.get("company_name", uid),
            "role": udata.get("role", "user"),
            "chats": chats,
        })

    most_active_chat_user = top_chat_users_enriched[0] if top_chat_users_enriched else None

    return {
        "user_rankings": ranked,
        "task_totals": task_totals,
        "total_events": len(_activity_log),
        "total_users": len(_users),
        "chat_tracker": {
            "total_chat_messages": task_totals.get("chat", 0),
            "most_active_chat_user": most_active_chat_user,
            "top_chat_users": top_chat_users_enriched,
            "top_search_queries": [{"query": q, "count": c} for q, c in top_queries],
            "top_search_terms": [{"term": t, "count": c} for t, c in top_terms],
        },
    }


@router.post("/chat-tracker/delete")
async def delete_chat_tracker_data(
    body: ChatTrackerDeleteRequest,
    token_data: dict = Depends(verify_admin),
):
    """
    Delete chat analytics source records from activity logs.
    target_type: top_user | search_term | search_query
    value: required unless delete_all is true
    """
    if not body.delete_all and not (body.value or "").strip():
        raise HTTPException(status_code=400, detail="value is required when delete_all is false")

    value = (body.value or "").strip()
    value_norm = _normalize_query(value)
    deleted = 0
    kept = []

    for entry in _activity_log:
        if entry.get("action") != "chat":
            kept.append(entry)
            continue

        uid = entry.get("user", "")
        query = _extract_chat_query(entry.get("detail", ""))
        query_norm = _normalize_query(query)

        should_delete = False
        if body.target_type == "top_user":
            should_delete = body.delete_all or (uid == value)
        elif body.target_type == "search_term":
            should_delete = body.delete_all or _is_term_in_query(query_norm, value_norm)
        elif body.target_type == "search_query":
            should_delete = body.delete_all or (query_norm == value_norm)

        if should_delete:
            deleted += 1
        else:
            kept.append(entry)

    _activity_log.clear()
    _activity_log.extend(kept)

    record_activity(
        token_data.get("sub", "admin"),
        "delete_chat_tracker",
        (
            f"Deleted {deleted} chat entries "
            f"(type={body.target_type}, value={value or 'all'}, delete_all={body.delete_all})"
        ),
    )

    return {
        "deleted": deleted,
        "remaining": len(_activity_log),
        "target_type": body.target_type,
        "value": value or "all",
        "delete_all": body.delete_all,
    }


# ── Delete Activity Logs by Period ───────────────────────────
@router.delete("/activity-logs")
async def delete_activity_logs(
    period: Optional[str] = None,   # week | month | three_months
    action_filter: Optional[str] = None,  # login | upload | analysis | chat | None (all)
    token_data: dict = Depends(verify_admin),
):
    """
    Delete activity log entries older than the given period.
    Also deletes old uploaded user files for matching windows.
    period: 'week' | 'month' | 'three_months' | 'year'
    action_filter: optional — restrict deletion to a specific action type
    """
    period_map = {
        "week": timedelta(weeks=1),
        "month": timedelta(days=30),
        "three_months": timedelta(days=90),
    }
    if period is None:
        period = _auto_delete_config.get("history_period", "month")

    if period not in period_map:
        raise HTTPException(status_code=400, detail=f"Invalid period. Use: {list(period_map.keys())}")

    cutoff = datetime.utcnow() - period_map[period]
    cutoff_str = cutoff.isoformat()
    cutoff_ts = cutoff.timestamp()

    kept = []
    deleted = 0

    for entry in _activity_log:
        ts = entry.get("timestamp", "")
        action = entry.get("action", "")

        # Determine if this entry is within the deletion window (older than cutoff)
        is_old = ts < cutoff_str

        # Apply action filter if provided
        action_match = (action_filter is None) or (action == action_filter)

        if is_old and action_match:
            deleted += 1
        else:
            kept.append(entry)

    # Replace the list in-place
    _activity_log.clear()
    _activity_log.extend(kept)

    # Delete old uploaded files to clean user-document history.
    deleted_files = 0
    uploads_root = Path(settings.USER_UPLOADS_DIR)
    should_cleanup_files = action_filter in (None, "upload", "analysis", "chat")
    if should_cleanup_files and uploads_root.exists():
        for user_dir in uploads_root.iterdir():
            if not user_dir.is_dir():
                continue
            for fpath in user_dir.iterdir():
                if not fpath.is_file():
                    continue
                try:
                    if fpath.stat().st_mtime < cutoff_ts:
                        fpath.unlink(missing_ok=True)
                        deleted_files += 1
                except Exception:
                    continue

            # Remove empty user folders after file cleanup
            try:
                if not any(user_dir.iterdir()):
                    user_dir.rmdir()
            except Exception:
                pass

    logger.info(
        f"Admin deleted {deleted} activity log entries and {deleted_files} files "
        f"(period={period}, filter={action_filter})"
    )
    record_activity(
        token_data.get("sub", "admin"),
        "delete_logs",
        (
            f"Deleted {deleted} log entries and {deleted_files} files "
            f"(period={period}, filter={action_filter or 'all'})"
        )
    )
    return {
        "deleted": deleted,
        "deleted_files": deleted_files,
        "remaining": len(_activity_log),
        "period": period,
        "action_filter": action_filter or "all",
    }
