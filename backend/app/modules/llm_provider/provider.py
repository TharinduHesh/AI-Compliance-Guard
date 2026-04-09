"""
LLM Provider — Multi-backend LLM loading, prompt formatting and generation.

Supports four modes (configured via LLM_PROVIDER env var):
  - "gemini"       → Google Gemini API (recommended, uses API key)
  - "llama_cpp"    → llama-cpp-python with GGUF quantised models
  - "transformers" → HuggingFace transformers pipeline
  - "none"         → disabled; chat engine falls back to rule-based responses

For Gemini: set GEMINI_API_KEY in your .env file.
For Llama: auto-downloads the model on first run if LLAMA_MODEL_PATH is empty.
"""

import logging
import os
import time
import hashlib
from pathlib import Path
from typing import Optional, List, Dict

from app.config.settings import settings

logger = logging.getLogger(__name__)

# ── Llama-2 / Llama-3 chat prompt templates ─────────────────────
SYSTEM_PROMPT = """You are an expert AI compliance assistant for AIComplianceGuard.
You are knowledgeable about ISO 27001, ISO 9001, NIST CSF, GDPR/PDPA, and the CIA triad.
You help users analyze compliance documents, find gaps, identify weak policies, and suggest improvements.
Answer concisely in well-structured Markdown. Use bullet points and headings for clarity.
If the user has uploaded a document, reference specific clauses when possible."""


def _build_llama2_prompt(system: str, messages: List[Dict[str, str]]) -> str:
    """Build a Llama-2-chat style prompt string."""
    parts = [f"<s>[INST] <<SYS>>\n{system}\n<</SYS>>\n\n"]
    for i, m in enumerate(messages):
        role, content = m["role"], m["content"]
        if role == "user":
            if i == 0:
                parts.append(f"{content} [/INST]")
            else:
                parts.append(f"<s>[INST] {content} [/INST]")
        elif role == "assistant":
            parts.append(f" {content} </s>")
    return "".join(parts)


def _build_llama3_prompt(system: str, messages: List[Dict[str, str]]) -> str:
    """Build a Llama-3-chat style prompt string."""
    parts = [
        "<|begin_of_text|>"
        f"<|start_header_id|>system<|end_header_id|>\n\n{system}<|eot_id|>"
    ]
    for m in messages:
        role = m["role"]
        parts.append(
            f"<|start_header_id|>{role}<|end_header_id|>\n\n{m['content']}<|eot_id|>"
        )
    parts.append("<|start_header_id|>assistant<|end_header_id|>\n\n")
    return "".join(parts)


class LLMProvider:
    """
    Unified LLM wrapper. Call `generate()` with a system prompt and
    a list of {role, content} messages.
    """

    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self._model = None
        self._tokenizer = None
        self._pipeline = None
        self._gemini_model = None
        self._gemini_clients = []
        self._is_loaded = False

        if self.provider == "none":
            logger.info("LLM provider disabled (LLM_PROVIDER=none). Using rule-based chat.")
            return

        logger.info(f"LLM provider: {self.provider}")

    # ── Lazy loading ──────────────────────────────────────────────
    @property
    def is_available(self) -> bool:
        if self.provider == "none":
            return False
        if not self._is_loaded:
            try:
                self._load_model()
            except Exception as e:
                logger.error(f"LLM model failed to load: {e}")
                return False
        return self._is_loaded

    def _resolve_model_path(self) -> str:
        """Return the local path to the GGUF file, downloading if needed."""
        if settings.LLAMA_MODEL_PATH and Path(settings.LLAMA_MODEL_PATH).exists():
            return settings.LLAMA_MODEL_PATH

        # Auto-download from Hugging Face Hub
        cache_dir = Path(settings.MODEL_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)
        local_path = cache_dir / settings.LLAMA_MODEL_FILE

        if local_path.exists():
            return str(local_path)

        logger.info(
            f"Downloading Llama GGUF model: {settings.LLAMA_MODEL_REPO} / "
            f"{settings.LLAMA_MODEL_FILE} → {local_path}"
        )
        try:
            from huggingface_hub import hf_hub_download

            downloaded = hf_hub_download(
                repo_id=settings.LLAMA_MODEL_REPO,
                filename=settings.LLAMA_MODEL_FILE,
                local_dir=str(cache_dir),
                local_dir_use_symlinks=False,
            )
            logger.info(f"Model downloaded to: {downloaded}")
            return downloaded
        except Exception as e:
            logger.error(f"Failed to download model: {e}")
            raise

    # ── Model loaders ─────────────────────────────────────────────
    def _load_model(self):
        if self._is_loaded:
            return

        if self.provider == "gemini":
            self._load_gemini()
        elif self.provider == "llama_cpp":
            self._load_llama_cpp()
        elif self.provider == "transformers":
            self._load_transformers()
        else:
            logger.warning(f"Unknown LLM_PROVIDER: {self.provider}")

    def _load_gemini(self):
        """Load Google Gemini model via the new google-genai SDK."""
        try:
            from google import genai
        except ImportError:
            raise ImportError(
                "google-genai is not installed. "
                "Run:  pip install google-genai"
            )

        key_candidates = [
            (settings.GEMINI_API_KEY or "").strip(),
            (settings.GEMINI_API_KEY_SECONDARY or "").strip(),
        ]
        api_keys = []
        for k in key_candidates:
            if k and k not in api_keys:
                api_keys.append(k)

        if not api_keys:
            raise RuntimeError(
                "No Gemini API key is configured. Add GEMINI_API_KEY (and optionally GEMINI_API_KEY_SECONDARY) to your .env file."
            )

        self._gemini_clients = [genai.Client(api_key=key) for key in api_keys]
        self._is_loaded = True
        logger.info(
            f"Gemini client pool initialised with {len(self._gemini_clients)} key(s) "
            f"(model: {settings.GEMINI_MODEL})"
        )

    def _load_llama_cpp(self):
        """Load model via llama-cpp-python."""
        try:
            from llama_cpp import Llama  # type: ignore
        except ImportError:
            raise ImportError(
                "llama-cpp-python is not installed. "
                "Run:  pip install llama-cpp-python  "
                "(add --extra-index-url for GPU builds)"
            )

        model_path = self._resolve_model_path()

        n_gpu = settings.LLAMA_N_GPU_LAYERS
        if settings.USE_GPU:
            n_gpu = max(n_gpu, 35)  # offload most layers

        logger.info(f"Loading Llama-cpp model: {model_path} (n_gpu_layers={n_gpu})")
        self._model = Llama(
            model_path=model_path,
            n_ctx=settings.LLAMA_CONTEXT_LENGTH,
            n_gpu_layers=n_gpu,
            n_threads=settings.LLAMA_N_THREADS,
            verbose=False,
        )
        self._is_loaded = True
        logger.info("Llama-cpp model loaded successfully")

    def _load_transformers(self):
        """Load model via HuggingFace transformers."""
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
            import torch
        except ImportError:
            raise ImportError("transformers and torch are required for the 'transformers' provider.")

        model_id = settings.LLAMA_HF_MODEL
        logger.info(f"Loading HF model: {model_id}")

        dtype = torch.float16 if settings.USE_GPU else torch.float32
        device_map = "auto" if settings.USE_GPU else "cpu"

        self._tokenizer = AutoTokenizer.from_pretrained(
            model_id, cache_dir=settings.MODEL_CACHE_DIR
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            cache_dir=settings.MODEL_CACHE_DIR,
            torch_dtype=dtype,
            device_map=device_map,
        )
        self._pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=self._tokenizer,
        )
        self._is_loaded = True
        logger.info("HF transformers model loaded successfully")

    # ── Generation ────────────────────────────────────────────────
    def generate(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str = SYSTEM_PROMPT,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        context_info: str = "",
        user_key: Optional[str] = None,
    ) -> str:
        """
        Generate a response from the Llama model.

        Args:
            messages: conversation history [{role: 'user'|'assistant', content: '...'}]
            system_prompt: system instructions
            context_info: extra context injected into the system prompt
                          (e.g. document clauses, framework data)
            max_tokens: override settings.LLAMA_MAX_TOKENS
            temperature: override settings.LLAMA_TEMPERATURE

        Returns:
            Generated text string.
        """
        if not self.is_available:
            raise RuntimeError("LLM is not available. Check logs for loading errors.")

        full_system = system_prompt
        if context_info:
            full_system += f"\n\n### Context\n{context_info}"

        if self.provider == "gemini":
            max_tok = max_tokens or settings.GEMINI_MAX_TOKENS
            temp = temperature or settings.GEMINI_TEMPERATURE
        else:
            max_tok = max_tokens or settings.LLAMA_MAX_TOKENS
            temp = temperature or settings.LLAMA_TEMPERATURE

        if self.provider == "gemini":
            return self._generate_gemini(full_system, messages, max_tok, temp, user_key=user_key)
        elif self.provider == "llama_cpp":
            return self._generate_llama_cpp(full_system, messages, max_tok, temp)
        elif self.provider == "transformers":
            return self._generate_transformers(full_system, messages, max_tok, temp)
        else:
            raise RuntimeError(f"Unknown provider: {self.provider}")

    def _generate_gemini(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int,
        temperature: float,
        user_key: Optional[str] = None,
    ) -> str:
        """Generate response using Google Gemini API (google-genai SDK)."""
        from google.genai import types

        # Build contents list for the API
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=m["content"])],
            ))

        config = types.GenerateContentConfig(
            system_instruction=system if system else None,
            max_output_tokens=max_tokens,
            temperature=temperature,
            top_p=settings.GEMINI_TOP_P,
        )

        # Models to try, in order — if primary hits rate limit, try fallbacks
        models_to_try = [settings.GEMINI_MODEL]
        fallbacks = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
        for fb in fallbacks:
            if fb != settings.GEMINI_MODEL:
                models_to_try.append(fb)

        client_sequence = self._select_gemini_client_sequence(user_key)

        last_exc = None
        for client_idx in client_sequence:
            client = self._gemini_clients[client_idx]
            for model_name in models_to_try:
                for attempt in range(3):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=contents,
                            config=config,
                        )
                        if model_name != settings.GEMINI_MODEL:
                            logger.info(f"Used fallback model: {model_name}")
                        return response.text.strip()
                    except Exception as e:
                        last_exc = e
                        err_str = str(e).lower()
                        if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                            wait = (attempt + 1) * 3
                            logger.warning(
                                f"Gemini rate-limited on key#{client_idx + 1} model {model_name} "
                                f"(attempt {attempt+1}/3). Retrying in {wait}s..."
                            )
                            time.sleep(wait)
                            continue
                        if "401" in err_str or "api key" in err_str or "permission" in err_str or "unauthorized" in err_str:
                            logger.warning(f"Gemini auth error on key#{client_idx + 1}. Trying next key.")
                            break
                        raise
                else:
                    # Retry loop exhausted for this model, try next model.
                    logger.warning(f"Model {model_name} exhausted on key#{client_idx + 1}, trying next fallback model...")
                    continue
                # Non-retryable auth error hit: switch key immediately.
                break

        raise RuntimeError(f"All Gemini models failed after retries: {last_exc}")

    def _select_gemini_client_sequence(self, user_key: Optional[str]) -> List[int]:
        """Select preferred Gemini key for a user, with remaining keys as fallbacks."""
        total = len(self._gemini_clients)
        if total <= 1:
            return [0] if total == 1 else []

        mode = (settings.GEMINI_KEY_SELECTION_MODE or "hash").strip().lower()
        if mode == "primary":
            preferred = 0
        else:
            stable_key = (user_key or "anonymous").strip().lower() or "anonymous"
            digest = hashlib.sha256(stable_key.encode("utf-8")).hexdigest()
            preferred = int(digest[:8], 16) % total

        order = [preferred]
        for idx in range(total):
            if idx != preferred:
                order.append(idx)
        return order

    def _generate_llama_cpp(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int,
        temperature: float,
    ) -> str:
        prompt = _build_llama2_prompt(system, messages)

        response = self._model(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=settings.LLAMA_TOP_P,
            stop=["</s>", "[INST]"],
            echo=False,
        )
        text = response["choices"][0]["text"].strip()
        return text

    def _generate_transformers(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int,
        temperature: float,
    ) -> str:
        prompt = _build_llama2_prompt(system, messages)

        outputs = self._pipeline(
            prompt,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=settings.LLAMA_TOP_P,
            do_sample=True,
            return_full_text=False,
        )
        text = outputs[0]["generated_text"].strip()
        return text


# ── Singleton ─────────────────────────────────────────────────────
llm_provider = LLMProvider()
