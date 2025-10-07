"""Sorting helpers for consistent ordering in list APIs."""

from __future__ import annotations

import re
from typing import Iterable

__all__ = ["korean_alnum_sort_key"]


_DIGIT_RE = re.compile(r"(\d+)")


def _natural_key(value: str) -> tuple[object, ...]:
    """Return a key that sorts numeric chunks as numbers and others case-insensitively."""
    parts: Iterable[str] = _DIGIT_RE.split(value)
    key: list[object] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            try:
                key.append(int(part))
                continue
            except ValueError:
                pass
        key.append(part.casefold())
    return tuple(key)


def korean_alnum_sort_key(value: str) -> tuple[int, tuple[object, ...]]:
    """Sort key prioritising Korean characters, then Latin letters, then digits.

    The returned tuple can be used directly with :func:`sorted` or ``list.sort`` to
    ensure a predictable order for folder and group names regardless of character set.
    """

    stripped = value.strip()
    if not stripped:
        return (3, ("",))

    first = stripped[0]
    if "가" <= first <= "힣" or "ㄱ" <= first <= "ㅎ":
        category = 0
    elif first.isalpha():
        category = 1
    elif first.isdigit():
        category = 2
    else:
        category = 3

    return (category, _natural_key(stripped))
