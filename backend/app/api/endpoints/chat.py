"""
Chat API Endpoints
ChatGPT-like conversational AI for compliance analysis
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
import logging
import secrets
import shutil
import os
from pathlib import Path
from datetime import datetime

from app.models.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatConversation,
    ChatWithDocumentResponse,
)
from app.modules.chat_engine import chat_engine
from app.config.settings import settings
from app.api.endpoints.auth import verify_token, record_activity
from fastapi import Depends

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(request: ChatMessageRequest, token_data: dict = Depends(verify_token)):
    """
    Send a chat message and get AI compliance response.
    If conversation_id is empty a new conversation is created.
    """
    user_id = token_data.get("sub", "unknown")
    try:
        conv_id = request.conversation_id or secrets.token_urlsafe(16)

        # Ensure conversation exists
        if chat_engine.get_conversation(conv_id) is None:
            chat_engine.create_conversation(conv_id)

        # Get AI response
        response_text = chat_engine.chat(conv_id, request.message)

        return ChatMessageResponse(
            conversation_id=conv_id,
            message=response_text,
            role="assistant",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Chat message error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process message")
    finally:
        record_activity(user_id, "chat", f"Chat message: {request.message[:80]}")


@router.post("/upload-and-ask", response_model=ChatWithDocumentResponse)
async def upload_and_ask(
    file: UploadFile = File(...),
    message: str = Form(default="Analyze this document for compliance"),
    conversation_id: str = Form(default=""),
    frameworks: str = Form(default="iso27001"),
    token_data: dict = Depends(verify_token),
):
    """
    Upload a document and ask a question about it in one step.
    """
    user_id = token_data.get("sub", "unknown")
    try:
        conv_id = conversation_id or secrets.token_urlsafe(16)

        # Ensure conversation exists
        if chat_engine.get_conversation(conv_id) is None:
            chat_engine.create_conversation(conv_id)

        # Validate file
        ext = Path(file.filename).suffix.lower()
        if ext not in ('.pdf', '.docx'):
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

        file_data = await file.read()
        if len(file_data) > settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_DOCUMENT_SIZE_MB}MB.")

        # Save temp file for processing
        temp_dir = Path(settings.TEMP_UPLOAD_DIR)
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = temp_dir / f"{conv_id}_{file.filename}"
        with open(temp_path, 'wb') as f:
            f.write(file_data)

        # Save permanent copy for admin viewing
        uploads_dir = Path(settings.USER_UPLOADS_DIR) / user_id
        uploads_dir.mkdir(parents=True, exist_ok=True)
        ts_prefix = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        perm_path = uploads_dir / f"{ts_prefix}_{file.filename}"
        with open(perm_path, 'wb') as f:
            f.write(file_data)

        # Attach document to conversation
        doc_summary = chat_engine.attach_document(conv_id, str(temp_path), file.filename)

        # If the user's message isn't a real question, auto-summarize the document
        vague_phrases = ['this is the document', 'here is the document', 'here it is',
                         'uploaded', 'here you go', 'check this', 'scan this',
                         'analyze this document for compliance']
        effective_message = message
        if message.lower().strip().rstrip('.!') in vague_phrases or len(message.strip()) < 10:
            effective_message = (
                f"I just uploaded '{file.filename}'. "
                "Please give me a comprehensive summary of this document and highlight "
                "any compliance-relevant sections you find."
            )

        # Process the user question
        response_text = chat_engine.chat(conv_id, effective_message)

        # Clean up temp file
        try:
            os.remove(temp_path)
        except Exception:
            pass

        record_activity(user_id, "upload", f"Uploaded {file.filename}")
        record_activity(user_id, "analysis", f"Analyzed {file.filename} (frameworks: {frameworks})")

        return ChatWithDocumentResponse(
            conversation_id=conv_id,
            message=response_text,
            role="assistant",
            document_name=file.filename,
            clauses_extracted=doc_summary.get('clauses_extracted', 0),
            timestamp=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload and ask error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process document and message")


@router.post("/upload-document")
async def upload_document_to_chat(
    file: UploadFile = File(...),
    conversation_id: str = Form(default=""),
    token_data: dict = Depends(verify_token),
):
    """
    Upload a document to an existing or new conversation (without asking a question).
    """
    user_id = token_data.get("sub", "unknown")
    try:
        conv_id = conversation_id or secrets.token_urlsafe(16)

        if chat_engine.get_conversation(conv_id) is None:
            chat_engine.create_conversation(conv_id)

        ext = Path(file.filename).suffix.lower()
        if ext not in ('.pdf', '.docx'):
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

        file_data = await file.read()

        temp_dir = Path(settings.TEMP_UPLOAD_DIR)
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = temp_dir / f"{conv_id}_{file.filename}"
        with open(temp_path, 'wb') as f:
            f.write(file_data)

        # Save permanent copy for admin viewing
        uploads_dir = Path(settings.USER_UPLOADS_DIR) / user_id
        uploads_dir.mkdir(parents=True, exist_ok=True)
        ts_prefix = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        perm_path = uploads_dir / f"{ts_prefix}_{file.filename}"
        with open(perm_path, 'wb') as f:
            f.write(file_data)

        doc_summary = chat_engine.attach_document(conv_id, str(temp_path), file.filename)

        # Clean up temp file
        try:
            os.remove(temp_path)
        except Exception:
            pass

        # Auto-generate a welcome message for the document
        welcome = chat_engine.chat(conv_id, "Give me a summary of this document")

        record_activity(user_id, "upload", f"Uploaded {file.filename}")

        return {
            "conversation_id": conv_id,
            "document_name": file.filename,
            "clauses_extracted": doc_summary.get('clauses_extracted', 0),
            "word_count": doc_summary.get('word_count', 0),
            "message": welcome,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload to chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload document")


@router.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    Get conversation history.
    """
    conv = chat_engine.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation_id": conv['id'],
        "created_at": conv.get('created_at'),
        "document_name": conv.get('document_name'),
        "messages": conv.get('messages', []),
    }


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    chat_engine.delete_conversation(conversation_id)
    return {"message": "Conversation deleted"}


@router.post("/new")
async def new_conversation():
    """Create a new empty conversation."""
    conv_id = secrets.token_urlsafe(16)
    chat_engine.create_conversation(conv_id)

    # Send initial greeting
    greeting = chat_engine.chat(conv_id, "hello")

    return {
        "conversation_id": conv_id,
        "message": greeting,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/llm/status")
async def llm_status():
    """Return current LLM provider status."""
    try:
        llm = chat_engine.llm
        if settings.LLM_PROVIDER == "gemini":
            model_name = settings.GEMINI_MODEL
        elif settings.LLM_PROVIDER == "llama_cpp":
            model_name = settings.LLAMA_MODEL_FILE
        else:
            model_name = settings.LLAMA_HF_MODEL
        return {
            "provider": settings.LLM_PROVIDER,
            "available": llm is not None,
            "model": model_name,
        }
    except Exception:
        return {
            "provider": settings.LLM_PROVIDER,
            "available": False,
            "model": None,
        }
