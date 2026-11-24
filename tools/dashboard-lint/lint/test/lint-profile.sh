#!/usr/bin/env bash
# Times each dashboard-lint engine on its own, in a throwaway clone with an uncommitted edit.
set -euo pipefail
repo=$(git -C "${1:-$PWD}" rev-parse --show-toplevel)
clone=$(mktemp -d "${TMPDIR:-/tmp}/lint-profile-XXXX")
trap 'rm -rf "$clone"' EXIT
git clone -q --shared --no-checkout "$repo" "$clone"
git -C "$clone" sparse-checkout set --no-cone /dashboard/ /biome.json /.gitignore /nixops/
git -C "$clone" checkout -q --detach "$(git -C "$repo" rev-parse HEAD)"
ln -s "$repo/node_modules" "$clone/node_modules"; ln -s "$repo/dashboard/node_modules" "$clone/dashboard/node_modules"
base=$(git -C "$clone" rev-parse HEAD)
# A typical agent change: edit two existing components and add a new one.
f1=dashboard/src/features/orgs/projects/services/components/ServicesList/ServicesList.tsx
f2=dashboard/src/components/common/CookieConsent/CookieConsent.tsx
sed -i.bak 's/className="/className="mt-1 /' "$clone/$f1" "$clone/$f2"; rm -f "$clone"/dashboard/src/**/*.bak "$clone/$f1.bak" "$clone/$f2.bak"
mkdir -p "$clone/dashboard/src/features/orgs/projects/Probe"
cat > "$clone/dashboard/src/features/orgs/projects/Probe/Probe.tsx" <<'TSX'
import { Button } from '@/components/ui/v3/button';
export default function Probe() {
  return <Button className="mt-2 p-4">x</Button>;
}
TSX
t() { local label=$1; shift; local s=$(date +%s%N); dashboard-lint --repo "$clone" --base "$base" "$@" >/dev/null 2>&1 || true; printf '%-34s %6d ms\n' "$label" $(( ($(date +%s%N) - s) / 1000000 )); }
design=design
biome_rules=$(dashboard-lint --list-rules --format json | jq -r '[.data.rules[] | select(.engine=="biome" or .engine=="biome-plugin") | .id] | join(",")')
script_rules=$(dashboard-lint --list-rules --format json | jq -r '[.data.rules[] | select(.engine=="script") | .id] | join(",")')
mode=${2:-warm}
if [ "$mode" = cold ]; then
  t "COLD $3" --rule "$(eval echo \$$3)"
  exit 0
fi
design=design; all=$(dashboard-lint --list-rules --format json | jq -r '[.data.rules[].id] | join(",")')
echo "== worktree mode (3 changed files)"
t "all engines, 1st run"
t "all engines, 2nd run"
t "biome rules" --rule "$biome_rules"
t "script (TS) rules" --rule "$script_rules"
t "design" --rule design
tc() { local label=$1; shift; local s=$(date +%s%N); dashboard-lint --repo "$clone" "$@" >/dev/null 2>&1 || true; printf '%-34s %6d ms\n' "$label" $(( ($(date +%s%N) - s) / 1000000 )); }
commit=$(git -C "$repo" log -1 --format=%h -- dashboard/src)
echo "== --commit mode ($commit, the latest commit that changed dashboard/src)"
tc "all engines" --commit "$commit"
tc "design" --commit "$commit" --rule design
tc "biome + script" --commit "$commit" --rule "$biome_rules,$script_rules"
