"""Utilities for working with Hanja terms."""
from __future__ import annotations

from functools import lru_cache
import json
import re
from typing import Iterable

import hanja
import requests

_WIKTIONARY_API_URL = "https://ko.wiktionary.org/w/api.php"
_WIKTIONARY_LANGUAGE = "한국어"
_WIKTIONARY_TIMEOUT = 6.0
_WIKTIONARY_HEADERS = {
    "User-Agent": "RememberWordAdmin/1.0 (+https://remember-word.local/; contact=admin@remember-word.local)",
}
_HEADING_PATTERN = re.compile(r"^(?P<equals>=+)\s*(?P<title>[^=]+?)\s*=+$")
_PAREN_PATTERN = re.compile(r"\([^)]*\)")
_TEMPLATE_PATTERN = re.compile(r"\{\{[^{}]*\}\}")
_LINK_PATTERN = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]")
_REF_PATTERN = re.compile(r"<ref[^>]*>.*?</ref>", re.DOTALL)


def contains_hanja(text: str | None) -> bool:
    """Return ``True`` if the given text includes at least one Hanja character."""

    if not text:
        return False
    return any(hanja.is_hanja(char) for char in str(text))


def _strip_templates(text: str) -> str:
    text = _REF_PATTERN.sub("", text)
    text = _TEMPLATE_PATTERN.sub("", text)
    return text


def _clean_definition(text: str) -> str:
    """Convert Wiktionary markup into a plain Korean sentence."""

    cleaned = _strip_templates(text)
    cleaned = _LINK_PATTERN.sub(r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""
    # Ensure the sentence ends with a closing punctuation mark.
    if cleaned[-1] not in ".!?":
        cleaned = f"{cleaned}."
    return cleaned


def _extract_dictionary_candidates(term: str) -> Iterable[str]:
    base = term.strip()
    if not base:
        return ()

    candidates: list[str] = []

    outer = _PAREN_PATTERN.sub("", base).strip()
    if outer:
        candidates.append(outer)

    if base and base not in candidates:
        candidates.append(base)

    for match in re.findall(r"\(([^)]+)\)", base):
        cleaned = match.strip()
        if cleaned and cleaned not in candidates:
            candidates.append(cleaned)

    expanded: list[str] = []
    for candidate in candidates:
        normalized = re.sub(r"[·∙•]", "", candidate).strip()
        if normalized and normalized not in candidates and normalized not in expanded:
            expanded.append(normalized)

    candidates.extend(expanded)

    return tuple(dict.fromkeys(candidates))


@lru_cache(maxsize=512)
def _fetch_wiktionary_extract(term: str) -> str:
    params = {
        "action": "query",
        "format": "json",
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "redirects": 1,
        "titles": term,
    }

    try:
        response = requests.get(
            _WIKTIONARY_API_URL,
            params=params,
            headers=_WIKTIONARY_HEADERS,
            timeout=_WIKTIONARY_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException:  # pragma: no cover - network issues
        return ""

    try:
        data = response.json()
    except json.JSONDecodeError:  # pragma: no cover - unexpected response
        return ""

    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        revisions = page.get("revisions") or []
        if not revisions:
            continue
        slot = revisions[0].get("slots", {}).get("main", {})
        extract = slot.get("*") or slot.get("content")
        if extract:
            return str(extract)
    return ""


@lru_cache(maxsize=1024)
def _lookup_wiktionary_definition(term: str) -> str:
    extract = _fetch_wiktionary_extract(term)
    if not extract:
        return ""

    current_language: str | None = None
    for raw_line in extract.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        heading = _HEADING_PATTERN.match(line)
        if heading:
            level = len(heading.group("equals"))
            if level == 2:
                current_language = heading.group("title").strip()
            continue
        if current_language != _WIKTIONARY_LANGUAGE:
            continue
        if not line.startswith("#"):
            continue
        if line.startswith("#*") or line.startswith("#:"):
            # Examples or quotations – skip.
            continue
        definition = line.lstrip("#").strip()
        cleaned = _clean_definition(definition)
        if cleaned:
            return cleaned

    return ""


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


def _is_redundant_translation(original: str, translated: str) -> bool:
    stripped_original = _PAREN_PATTERN.sub("", original).strip()
    stripped_translated = _PAREN_PATTERN.sub("", translated).strip()
    if stripped_original and stripped_original == stripped_translated:
        return True
    return False


def lookup_meaning(term: str | None) -> str:
    """Return a best-effort Korean meaning for a term.

    The function first consults Wiktionary for a true definition. If none is
    available it falls back to the existing Hangul substitution logic provided
    by :mod:`hanja`.
    """

    if not term:
        return ""

    normalized = str(term).strip()
    if not normalized:
        return ""

    for candidate in _extract_dictionary_candidates(normalized):
        meaning = _lookup_wiktionary_definition(candidate)
        if meaning:
            return meaning

    try:
        phrase_translation = hanja.translate(normalized, "substitution")
    except Exception:  # pragma: no cover - safety net for unexpected library errors
        phrase_translation = ""

    if (
        phrase_translation
        and phrase_translation != normalized
        and not _is_redundant_translation(normalized, phrase_translation)
    ):
        return phrase_translation

    pieces: list[str] = []
    for char in normalized:
        translated = _translate_character(char)
        pieces.append(translated or char)

    candidate = "".join(pieces).strip()
    if (
        candidate
        and candidate != normalized
        and not _is_redundant_translation(normalized, candidate)
    ):
        return candidate

    return ""
