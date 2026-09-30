#!/usr/bin/env bash
# Fails when a template's duplicated agent-context files have drifted apart.
#
# Every template ships the same guidance twice: AGENTS.md next to a
# byte-identical CLAUDE.md, and SKILLS.md next to one
# `.claude/skills/<name>/SKILL.md` per workflow. Nothing derives one copy from
# the other at build time, so this check is what stops a scaffolded project
# from shipping two copies that tell an agent different things. See "Maintainer
# invariants" in templates/README.md.
#
# A SKILL.md body equals its SKILLS.md section once the YAML frontmatter and
# the `# Title` line are stripped and every `## ` subheading is demoted to
# `### `. Blank lines around a section are not significant.
#
# Usage: ./templates/check-agent-context.sh
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

status=0

fail() {
	printf '::error::%s\n' "$1" >&2
	status=1
}

# shellcheck disable=SC2016 # awk program text: `$0` is awk's, not the shell's
strip_frontmatter='
  NR == 1 && $0 == "---" { in_frontmatter = 1; next }
  in_frontmatter { if ($0 == "---") in_frontmatter = 0; next }
'

skill_title() {
	awk "$strip_frontmatter"'
    /^# / { sub(/^# /, ""); print; exit }
  ' "$1"
}

skill_body() {
	awk "$strip_frontmatter"'
    !title_seen && /^# / { title_seen = 1; next }
    { sub(/^## /, "### "); print }
  ' "$1"
}

# The `## <title>` section of a SKILLS.md, heading line excluded.
skills_section() {
	awk -v heading="## $2" '
    $0 == heading { in_section = 1; next }
    in_section && /^## / { exit }
    in_section { print }
  ' "$1"
}

strip_blank_edges() {
	awk '
    { line[NR] = $0 }
    END {
      first = 1
      while (first <= NR && line[first] ~ /^[[:space:]]*$/) first++
      last = NR
      while (last >= first && line[last] ~ /^[[:space:]]*$/) last--
      for (i = first; i <= last; i++) print line[i]
    }
  '
}

# A template is a directory shipping a frontend app. Anything else under
# templates/ is tooling, so it is neither checked nor counted.
templates_checked=0

for template in templates/*/; do
	template=${template%/}

	[ -f "$template/frontend/package.json" ] || continue
	templates_checked=$((templates_checked + 1))

	# The bundle is mandatory, not opt-in. Checking only what happens to be
	# there passes a template that ships no agent context at all, which is the
	# one case where an agent has nothing to go on.
	if [ ! -f "$template/AGENTS.md" ] || [ ! -f "$template/CLAUDE.md" ]; then
		fail "$template must ship both AGENTS.md and CLAUDE.md, byte-identical."
	elif ! diff -u "$template/AGENTS.md" "$template/CLAUDE.md"; then
		fail "$template/AGENTS.md and $template/CLAUDE.md have drifted apart; copy one over the other."
	fi

	skills_doc=$template/SKILLS.md
	skills_dir=$template/.claude/skills
	if [ ! -f "$skills_doc" ]; then
		fail "$skills_doc is missing; agents that do not read .claude/ would see none of the template's workflows."
		continue
	fi
	if [ ! -d "$skills_dir" ]; then
		fail "$skills_dir is missing; Claude Code would discover none of the template's workflows."
		continue
	fi

	shipped_titles=""
	skills_checked=0
	for skill in "$skills_dir"/*/SKILL.md; do
		[ -f "$skill" ] || continue
		skills_checked=$((skills_checked + 1))

		title=$(skill_title "$skill")
		if [ -z "$title" ]; then
			fail "$skill has no \`# Title\` heading, so it cannot be matched to a $skills_doc section."
			continue
		fi
		shipped_titles="$shipped_titles$title
"

		expected=$(skills_section "$skills_doc" "$title" | strip_blank_edges)
		if [ -z "$expected" ]; then
			fail "$skills_doc has no \`## $title\` section for $skill."
			continue
		fi

		actual=$(skill_body "$skill" | strip_blank_edges)
		if [ "$expected" != "$actual" ]; then
			fail "$skill and the \`## $title\` section of $skills_doc have drifted apart; update both copies."
			diff -u \
				--label "$skills_doc (## $title)" \
				--label "$skill (## demoted to ###)" \
				<(printf '%s\n' "$expected") <(printf '%s\n' "$actual")
		fi
	done

	while IFS= read -r title; do
		[ -n "$title" ] || continue
		printf '%s' "$shipped_titles" | grep -Fxq "$title" && continue
		fail "$skills_doc documents \`## $title\` but no $skills_dir/*/SKILL.md ships it; Claude Code would not discover that workflow."
	done < <(awk '/^## / { sub(/^## /, ""); print }' "$skills_doc")

	# Same vacuous-pass hole as the outer templates_checked counter: an empty
	# skills_dir and a SKILLS.md with no `## ` sections would otherwise pass
	# with zero workflows checked, which is the one case an agent has nothing
	# to go on.
	if [ "$skills_checked" -eq 0 ]; then
		fail "$skills_dir ships no */SKILL.md; this template's workflows are undiscoverable and this guard checked none of them."
	fi
done

# Without this the whole check passes vacuously when the glob matches nothing,
# which is what a renamed or moved templates/ directory looks like.
if [ "$templates_checked" -eq 0 ]; then
	fail "no templates found under templates/*/; this guard checked nothing."
fi

if [ "$status" -eq 0 ]; then
	echo "templates: agent-context files are consistent ($templates_checked checked)"
fi

exit "$status"
