from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import settings
from app.services.translations.languages import LANGUAGE_NAME_BY_CODE


class TranslationUnavailableError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def _language_name(language_code: str) -> str:
    if language_code in LANGUAGE_NAME_BY_CODE:
        return LANGUAGE_NAME_BY_CODE[language_code]

    primary_code = language_code.split("-")[0]
    return LANGUAGE_NAME_BY_CODE.get(primary_code, language_code)


def translate_job_content(
    *,
    source_language_code: str,
    target_language_code: str,
    text: str,
    client: httpx.Client | None = None,
) -> str:
    if not text.strip():
        raise TranslationUnavailableError(
            "missing_source_text",
            "Source text is required before translation can run.",
        )

    if (
        source_language_code == target_language_code
        or source_language_code.split("-")[0] == target_language_code.split("-")[0]
    ):
        return text

    if not settings.openai_api_key:
        raise TranslationUnavailableError(
            "translation_not_configured",
            "OpenAI translation is not configured in the current environment.",
        )

    target_language_name = _language_name(target_language_code)
    source_language_name = _language_name(source_language_code)

    payload = {
        "model": settings.translation_model,
        "input": (
            f"Translate the following {source_language_name} text into {target_language_name}. "
            "Preserve names, numbers, formatting, and meaning. Return only the translated text.\n\n"
            f"{text}"
        ),
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    api_client = client or httpx.Client(timeout=60.0)
    should_close = client is None

    try:
        response = api_client.post(
            f"{settings.openai_base_url.rstrip('/')}/responses",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        translated_text = body.get("output_text", "").strip()
        if not translated_text:
            raise TranslationUnavailableError(
                "translation_failed",
                "The translation provider returned an empty response.",
            )

        return translated_text
    except httpx.HTTPError as exc:
        raise TranslationUnavailableError(
            "translation_failed",
            f"Translation request failed: {exc}",
        ) from exc
    finally:
        if should_close:
            api_client.close()
