#!/usr/bin/env python3
"""Checks a skills-only ZIP against OpenAI's archive rules before upload.
Rules: https://developers.openai.com/plugins/deploy/submission-errors
Usage: python3 scripts/verify-openai-archive.py dist/*.zip
"""
import json, re, sys, zipfile

FORBIDDEN = {".mcp.json", "mcp.json", ".app.json", "marketplace.json"}


def check(path):
    errors = []
    info = []
    with zipfile.ZipFile(path) as z:
        if z.testzip() is not None:
            errors.append("corrupt entry")
        names = [n for n in z.namelist() if not n.endswith("/")]
        entries = z.infolist()
        size = sum(e.file_size for e in entries)
        import os
        if os.path.getsize(path) > 100 * 1024 * 1024:
            errors.append("compressed size > 100 MB")
        if size > 512 * 1024 * 1024:
            errors.append("extracted size > 512 MiB")
        if len(entries) > 5000:
            errors.append("more than 5000 entries")
        for n in names:
            if ".." in n.split("/") or n.startswith("/") or "\\" in n:
                errors.append(f"bad path {n}")
            if n.count("/") > 20:
                errors.append(f"path deeper than 20 levels: {n}")
            if n.split("/")[-1] in FORBIDDEN:
                errors.append(f"forbidden file in skills-only upload: {n}")
        tops = {n.split("/")[0] for n in z.namelist()}
        if len(tops) != 1:
            errors.append(f"expected one top-level directory, found {sorted(tops)}")
        top = sorted(tops)[0]
        manifests = [m for m in (f"{top}/.codex-plugin/plugin.json", f"{top}/.claude-plugin/plugin.json") if m in names]
        if len(manifests) != 1:
            errors.append(f"expected exactly one manifest, found {manifests}")
        else:
            m = json.loads(z.read(manifests[0]))
            info.append(f"manifest {manifests[0].split('/', 1)[1]}: name={m.get('name')} version={m.get('version')}")
            if not str(m.get("description", "")).strip():
                errors.append("manifest description is empty")
            for k in ("mcpServers", "apps"):
                if k in m:
                    errors.append(f"manifest must not declare {k} in a skills-only upload")
            ui = m.get("interface")
            if ui:
                if "screenshots" in ui:
                    errors.append("interface.screenshots not allowed for skills-only")
                for k in ("logo", "composerIcon"):
                    p = ui.get(k, "").lstrip("./")
                    if p and f"{top}/{p}" not in names:
                        errors.append(f"interface.{k} file missing: {p}")
        skills = sorted({n.split("/")[2] for n in names if re.match(rf"{re.escape(top)}/skills/[^/]+/SKILL\.md$", n)})
        if not skills:
            errors.append("no skills/<name>/SKILL.md found")
        for s in skills:
            text = z.read(f"{top}/skills/{s}/SKILL.md").decode()
            fm = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
            if not fm:
                errors.append(f"{s}: missing frontmatter")
                continue
            meta = dict(l.split(":", 1) for l in fm.group(1).splitlines() if ":" in l)
            desc = meta.get("description", "").strip()
            if meta.get("name", "").strip() != s:
                errors.append(f"{s}: frontmatter name != folder")
            if not desc or len(desc) > 1024:
                errors.append(f"{s}: description missing or > 1024 chars ({len(desc)})")
            if not fm.group(2).strip():
                errors.append(f"{s}: empty body")
            if len(f"nhost:{s}") > 64:
                errors.append(f"{s}: plugin:skill identity > 64 chars")
            for rel in re.findall(r"\]\((references/[^)#]+)", fm.group(2)):
                if f"{top}/skills/{s}/{rel}" not in names:
                    errors.append(f"{s}: broken reference link {rel}")
        info.append(f"{len(skills)} skills: {', '.join(skills)}; {len(names)} files; {size/1024:.0f} KiB extracted")
    print(f"{'OK  ' if not errors else 'FAIL'} {path}")
    for i in info:
        print(f"     {i}")
    for e in errors:
        print(f"     ✗ {e}")
    return not errors


ok = all([check(p) for p in sys.argv[1:]])
sys.exit(0 if ok else 1)
