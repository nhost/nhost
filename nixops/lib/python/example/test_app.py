"""Behavioural tests for :mod:`app`."""

from app import hello


def test_greets_by_name() -> None:
    assert hello("World") == "Hello, World!"
