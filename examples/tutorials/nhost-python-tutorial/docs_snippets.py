#!/usr/bin/env python3
"""Keeps the Python tutorial pages' programs honest.

Each part of the tutorial ends with the complete `main.py` a reader should
have by then. Nothing else checks those listings, so an SDK change can leave
the pages publishing Python that no longer type-checks. Each listing also folds the
lines the reader has already seen (`collapse={...}`) and highlights the ones
the part added (`{...}`); those ranges are only right for the listing they
were computed from.

    docs_snippets.py PAGES_DIR extract OUT_DIR   write docs_part_<n>.py per part
    docs_snippets.py PAGES_DIR ranges            fail if a range is stale
    docs_snippets.py PAGES_DIR ranges --write    recompute the ranges in place

`extract` is what the Nix check lints and type-checks, with the same ruff and
mypy settings as main.py. A page
without a complete listing is a failure, so the fence pattern cannot rot into
checking nothing.
"""

from __future__ import annotations

import difflib
import re
import sys
from pathlib import Path

# A `main.py` fence and its body. The optional meta after the title holds
# the collapse and highlight ranges.
FENCE = re.compile(
    r'^```python title="main\.py"(?P<meta>[^\n]*)\n(?P<body>.*?)^```$',
    re.MULTILINE | re.DOTALL,
)
PART = re.compile(r"^(\d+)-.*\.mdx$")


def listings(pages: Path) -> list[tuple[Path, re.Match[str]]]:
    """The complete program of each part, in order."""
    found = []
    for page in sorted(pages.glob("*.mdx"), key=lambda p: int(PART.match(p.name)[1])):
        complete = [m for m in FENCE.finditer(page.read_text()) if "def main(" in m["body"]]
        if not complete:
            sys.exit(f"{page}: no complete main.py listing")
        found.append((page, complete[-1]))
    if not found:
        sys.exit(f"{pages}: no tutorial pages")
    return found


def spans(lines: list[int]) -> str:
    """1-based line numbers as `a-b` ranges; a single line is `a-a`, because
    Expressive Code's collapse silently drops a bare number."""
    out = []
    for n in lines:
        if out and out[-1][1] == n - 1:
            out[-1][1] = n
        else:
            out.append([n, n])
    return ",".join(f"{a}-{b}" for a, b in out)


def ranges_meta(previous: str, current: str) -> str:
    """Collapse the lines `current` shares with `previous`, highlight the rest."""
    old, new = previous.splitlines(), current.splitlines()
    kept = set()
    for block in difflib.SequenceMatcher(a=old, b=new, autojunk=False).get_matching_blocks():
        kept.update(range(block.b + 1, block.b + block.size + 1))
    collapsed = [n for n in range(1, len(new) + 1) if n in kept]
    added = [n for n in range(1, len(new) + 1) if n not in kept]
    meta = []
    if collapsed:
        meta.append(f"collapse={{{spans(collapsed)}}}")
    if added:
        meta.append(f"{{{spans(added)}}}")
    return (" " + " ".join(meta)) if meta else ""


def extract(pages: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for page, match in listings(pages):
        part = PART.match(page.name)[1]
        (out / f"docs_part_{part}.py").write_text(match["body"])


def ranges(pages: Path, write: bool) -> None:
    stale = []
    previous = None
    for page, match in listings(pages):
        # Part 1 has nothing earlier to fold.
        want = "" if previous is None else ranges_meta(previous, match["body"])
        previous = match["body"]
        if match["meta"] == want:
            continue
        if write:
            text = page.read_text()
            start, end = match.span("meta")
            page.write_text(text[:start] + want + text[end:])
        else:
            stale.append(f"{page.name}: have `{match['meta'].strip()}`, want `{want.strip()}`")
    if stale:
        sys.exit(
            "collapse/highlight ranges are stale; rerun with `ranges --write`:\n"
            + "\n".join(stale)
        )


def main(argv: list[str]) -> None:
    if len(argv) >= 3 and argv[2] == "extract" and len(argv) == 4:
        extract(Path(argv[1]), Path(argv[3]))
    elif len(argv) in (3, 4) and argv[2] == "ranges" and argv[3:] in ([], ["--write"]):
        ranges(Path(argv[1]), write=argv[3:] == ["--write"])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
