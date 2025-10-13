"""Utilities for working with Hanja terms."""
from __future__ import annotations

from functools import lru_cache

import hanja


def contains_hanja(text: str | None) -> bool:
    """Return ``True`` if the given text includes at least one Hanja character."""

    if not text:
        return False
    return any(hanja.is_hanja(char) for char in str(text))


@lru_cache(maxsize=1024)
def _translate_character(char: str) -> str:
    if not char:
        return ""
    try:
        translated = hanja.translate(char, "substitution")
    except Exception:  # pragma: no cover - safety net for unexpected library errors
        return ""
    if translated == char:
        return ""
    return translated


def lookup_meaning(term: str | None) -> str:
    """Return a best-effort Hangul meaning for a Hanja term.

    The function first tries to translate the entire phrase. If that fails to
    produce any Hangul output, it falls back to translating character by
    character and concatenating the results. When no translation is available,
    an empty string is returned so that callers can decide how to handle the
    fallback.
    """

    if not term:
        return ""

    normalized = str(term).strip()
    if not normalized:
        return ""

    try:
        phrase_translation = hanja.translate(normalized, "substitution")
    except Exception:  # pragma: no cover - safety net for unexpected library errors
        phrase_translation = ""

    if phrase_translation and phrase_translation != normalized:
        return phrase_translation

    pieces: list[str] = []
    for char in normalized:
        translated = _translate_character(char)
        pieces.append(translated or char)

    candidate = "".join(pieces).strip()
    if candidate and candidate != normalized:
        return candidate

    return ""
