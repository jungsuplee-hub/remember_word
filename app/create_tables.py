"""Utility script to create the database schema."""

import sys


MIN_PYTHON = (3, 8)

if sys.version_info < MIN_PYTHON:
    raise SystemExit(
        "Python {0}.{1}+ is required. Please run this script with `python3`.".format(
            *MIN_PYTHON
        )
    )

from database import ensure_schema

if __name__ == "__main__":
    ensure_schema()
    print("Tables created.")
