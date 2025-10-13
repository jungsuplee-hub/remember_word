"""Tests for the Hanja lookup utilities."""
from __future__ import annotations

from pathlib import Path
import sys

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
APP_PATH = PROJECT_ROOT / "app"
if str(APP_PATH) not in sys.path:
    sys.path.insert(0, str(APP_PATH))

import utils.hanja_lookup as hanja_lookup  # noqa: E402


@pytest.fixture(autouse=True)
def reset_caches():
    """Ensure cached helpers are cleared between tests."""

    hanja_lookup._fetch_wiktionary_extract.cache_clear()
    hanja_lookup._lookup_wiktionary_definition.cache_clear()  # type: ignore[attr-defined]
    hanja_lookup._translate_character.cache_clear()
    yield
    hanja_lookup._fetch_wiktionary_extract.cache_clear()
    hanja_lookup._lookup_wiktionary_definition.cache_clear()  # type: ignore[attr-defined]
    hanja_lookup._translate_character.cache_clear()


def test_lookup_meaning_prefers_dictionary(monkeypatch: pytest.MonkeyPatch) -> None:
    """Meanings from the dictionary should override Hangul substitution."""

    def fake_lookup(term: str) -> str:
        if term == "친구":
            return "가깝게 오래 사귄 사람."
        return ""

    monkeypatch.setattr(hanja_lookup, "_lookup_wiktionary_definition", fake_lookup)

    result = hanja_lookup.lookup_meaning("친구(親舊)")
    assert result == "가깝게 오래 사귄 사람."


def test_lookup_meaning_falls_back_to_translation(monkeypatch: pytest.MonkeyPatch) -> None:
    """When the dictionary lookup fails, fall back to the hanja library."""

    monkeypatch.setattr(hanja_lookup, "_lookup_wiktionary_definition", lambda _: "")

    result = hanja_lookup.lookup_meaning("親舊")
    assert result == "친구"
