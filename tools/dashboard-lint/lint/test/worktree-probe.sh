#!/usr/bin/env bash
# Creates an untracked folder full of violations in the current worktree, lints the
# working tree, deletes the folder, and checks every planted rule was reported.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
lint="$(dirname "$(readlink -f "$0")")/../bin/dashboard-lint"
dir="$repo/dashboard/src/features/orgs/projects/database/LintProbe"
[ -e "$dir" ] && { echo "refusing: $dir already exists" >&2; exit 2; }
trap 'rm -rf "$dir"' EXIT
mkdir -p "$dir"
cat > "$dir/LintProbe.tsx" <<'EOF'
import { useEffect, useState } from 'react';
import { ActionRelationshipDialog } from '@/features/orgs/projects/graphql/actions/components/ActionRelationshipDialog';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog/DiscardChangesDialog';

const LintProbe = ({ value, kind }: { value: string; kind: number }) => {
  const [copy, setCopy] = useState(value);
  useEffect(() => {
    setCopy(value);
  }, [value]);
  const label = kind === 1 ? 'one' : kind === 2 ? 'two' : 'many';
  return (
    <div>
      {/* Header */}
      <span>{copy} {label}</span>
      <ActionRelationshipDialog />
      <DiscardChangesDialog />
    </div>
  );
};

export default LintProbe;
EOF
cat > "$dir/LintProbe.test.tsx" <<'EOF'
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@/tests/testUtils';
import LintProbe from './LintProbe';

describe('LintProbe', () => {
  test('renders', () => {
    const { container } = render(<LintProbe value="a" kind={1} />);
    fireEvent.click(container.querySelector('span')!);
    if (container) {
      expect(container).toBeTruthy();
    }
  });
});
EOF
expected="effect-only-sets-state feature-boundaries folder-needs-index function-declarations import-folder-not-file it-not-test no-conditional-expect no-fire-event no-jsx-comments no-nested-ternary no-query-selector-in-tests no-vitest-imports"
got=$(cd "$repo" && "$lint" --format json | jq -r '[.data.findings[].rule] | unique | join(" ")' || true)
missing=$(for rule in $expected; do case " $got " in *" $rule "*) ;; *) printf '%s ' "$rule" ;; esac; done)
if [ -z "$missing" ]; then
  echo "PASS worktree probe: $(echo "$expected" | wc -w | tr -d ' ') planted rules reported"
  echo "  all reported: $got"
else
  echo "FAIL worktree probe"; echo "  missing: $missing"; echo "  got:     $got"; exit 1
fi
