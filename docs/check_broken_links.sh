#!/usr/bin/env bash

set -euo pipefail

pnpm exec mintlify broken-links | tee $TMPDIR/broken_links_output.txt
grep -q "success" $TMPDIR/broken_links_output.txt
