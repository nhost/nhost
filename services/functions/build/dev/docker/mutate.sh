#!/usr/bin/env bash
# Choreographed file mutations against example-pnpm/functions/, run after
# dev-env-up. The integration tests (which run inside a Nix build sandbox and
# can't write to the host) read /_nhost_functions_events and assert that
# chokidar in the container observed each mutation, plus check the resulting
# route bodies.
set -euo pipefail

PORT="${MUTATE_PORT:-3002}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../../example-pnpm/functions && pwd)"

# Each mutation step needs to outlast chokidar's polling cycle:
#   interval: 1000ms + awaitWriteFinish.stabilityThreshold: 200ms ≈ 1.2s
# Using 2s keeps the script well clear of the floor.
WAIT="${MUTATE_WAIT:-2}"

log() { echo "[mutate] $*"; }

log "waiting for healthz on :$PORT..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

log "waiting for initial rebuild to complete..."
for _ in $(seq 1 60); do
  completed=$(curl -sf "http://127.0.0.1:$PORT/_nhost_functions_rebuild_stats" \
    | sed -n 's/.*"rebuildsCompleted":\([0-9]*\).*/\1/p')
  if [ -n "$completed" ] && [ "$completed" -ge 1 ]; then
    break
  fi
  sleep 1
done

log "mutating files in $DIR"

# 1. add: create a new function file.
cat > "$DIR/hotreload-makefile-add.js" <<'EOF'
module.exports = (req, res) => res.json({ marker: 'added-via-makefile' });
EOF
sleep "$WAIT"

# 2. add then change: write first content, then overwrite.
cat > "$DIR/hotreload-makefile-change.js" <<'EOF'
module.exports = (req, res) => res.json({ value: 'first' });
EOF
sleep "$WAIT"
cat > "$DIR/hotreload-makefile-change.js" <<'EOF'
module.exports = (req, res) => res.json({ value: 'second' });
EOF
sleep "$WAIT"

# 3. add then unlink: route should 404 by the end.
cat > "$DIR/hotreload-makefile-delete.js" <<'EOF'
module.exports = (req, res) => res.json({ marker: 'will-be-deleted' });
EOF
sleep "$WAIT"
rm "$DIR/hotreload-makefile-delete.js"
sleep "$WAIT"

# 4. _utils edit: changes /hotreload-consumer's bundled output without
# restoring — the test asserts on the new computation.
cat > "$DIR/_utils/hotreload-helper.js" <<'EOF'
export function compute(a, b) {
  return (a + b) * 10;
}
EOF
sleep "$WAIT"

log "done"
