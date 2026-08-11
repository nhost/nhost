#!/usr/bin/env bash
#
# Compare benchmarks against a baseline to detect regressions or stale baselines.
# Exits non-zero if any benchmark deviates beyond the threshold in either direction.
#
# Modes:
#   Local:  compares against the committed baseline.txt file.
#   CI:     checks out the base branch, benchmarks it, then benchmarks HEAD,
#           and compares the two on the same machine.
#
# Usage:
#   ./benchmark/check.sh -baseline baseline.txt        # local: compare against a baseline file
#   ./benchmark/check.sh -base main                   # CI: benchmark main vs current HEAD
#   ./benchmark/check.sh -base main -count 10         # CI: with custom run count
#   ./benchmark/check.sh -threshold 20                 # override deviation threshold (%)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COUNT=6
THRESHOLD=10
BASE_REF=""
LOCAL_BASELINE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -count)     COUNT="$2"; shift 2 ;;
        -threshold) THRESHOLD="$2"; shift 2 ;;
        -base)      BASE_REF="$2"; shift 2 ;;
        -baseline)  LOCAL_BASELINE="$2"; shift 2 ;;
        *)          echo "Unknown flag: $1" >&2; exit 1 ;;
    esac
done

if ! command -v benchstat &>/dev/null; then
    echo "ERROR: benchstat not found. Install with:" >&2
    echo "  go install golang.org/x/perf/cmd/benchstat@latest" >&2
    exit 1
fi

run_benchmarks() {
    go test ./benchmark/ -bench=. -benchmem -count="$COUNT" -timeout=30m
}

BASELINE=$(mktemp)
CURRENT=$(mktemp)
trap 'rm -f "$BASELINE" "$CURRENT"' EXIT

if [[ -n "$BASE_REF" ]]; then
    # CI mode: benchmark the base branch in a worktree, then benchmark HEAD.
    echo "=== CI mode: comparing ${BASE_REF} vs HEAD ==="

    HEAD_REF=$(git rev-parse HEAD)
    WORKTREE=$(mktemp -d)
    trap 'rm -f "$BASELINE" "$CURRENT"; git worktree remove --force "$WORKTREE" 2>/dev/null || true' EXIT

    echo ""
    echo "Benchmarking base (${BASE_REF})..."
    git worktree add --quiet "$WORKTREE" "$BASE_REF"
    (cd "$WORKTREE" && run_benchmarks) > "$BASELINE"

    echo "Benchmarking HEAD (${HEAD_REF:0:12})..."
    run_benchmarks > "$CURRENT"
else
    # Local mode: compare against a baseline file.
    if [[ -z "$LOCAL_BASELINE" ]]; then
        echo "ERROR: -baseline is required in local mode" >&2
        echo "Generate one with:" >&2
        echo "  go test ./benchmark/ -bench=. -benchmem -count=${COUNT} > baseline.txt" >&2
        echo "Then run:" >&2
        echo "  ./benchmark/check.sh -baseline baseline.txt" >&2
        exit 1
    fi

    if [[ ! -f "$LOCAL_BASELINE" ]]; then
        echo "ERROR: baseline file not found: $LOCAL_BASELINE" >&2
        exit 1
    fi

    cp "$LOCAL_BASELINE" "$BASELINE"

    echo "=== Local mode: comparing against $LOCAL_BASELINE ==="
    echo ""
    echo "Running benchmarks (count=${COUNT})..."
    run_benchmarks > "$CURRENT"
fi

echo ""
echo "=== Benchmark comparison ==="
echo ""

OUTPUT=$(benchstat "$BASELINE" "$CURRENT")
echo "$OUTPUT"

# Check for deviations in either direction. benchstat output format:
#   -75.82% (p=0.002 n=6)   <- improvement (baseline is stale)
#   +12.34% (p=0.001 n=6)   <- regression
# We extract the absolute percentage and compare against the threshold.
REGRESSIONS=()
IMPROVEMENTS=()
while IFS= read -r line; do
    if echo "$line" | grep -qE '[+-][0-9]+\.[0-9]+% \(p=0\.[0-9]+'; then
        pct=$(echo "$line" | grep -oE '[+-][0-9]+\.[0-9]+%' | head -1)
        abs="${pct//[+\-%]/}"
        if (( $(echo "$abs > $THRESHOLD" | bc -l) )); then
            bench=$(echo "$line" | awk '{print $1}')
            if [[ "$pct" == +* ]]; then
                REGRESSIONS+=("  ${bench}: ${pct}")
            else
                IMPROVEMENTS+=("  ${bench}: ${pct}")
            fi
        fi
    fi
done <<< "$OUTPUT"

echo ""
if [[ ${#REGRESSIONS[@]} -gt 0 || ${#IMPROVEMENTS[@]} -gt 0 ]]; then
    if [[ ${#REGRESSIONS[@]} -gt 0 ]]; then
        echo "Regressions (>${THRESHOLD}%):"
        printf '%s\n' "${REGRESSIONS[@]}"
    fi
    if [[ ${#IMPROVEMENTS[@]} -gt 0 ]]; then
        echo "Improvements (>${THRESHOLD}%) — baseline is stale:"
        printf '%s\n' "${IMPROVEMENTS[@]}"
    fi
    echo ""
    echo "FAIL: benchmarks deviated beyond ±${THRESHOLD}%"
    if [[ -z "$BASE_REF" ]]; then
        echo "If changes are expected, update the baseline:"
        echo "  go test ./benchmark/ -bench=. -benchmem -count=${COUNT} > benchmark/baseline.txt"
    fi
    exit 1
else
    echo "OK: all benchmarks within ±${THRESHOLD}% of baseline"
fi
