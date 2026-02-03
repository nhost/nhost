#!/usr/bin/env bash

set -euo pipefail

mintlify broken-links | tee $TMPDIR/broken_links_output.txt
grep -q "success" $TMPDIR/broken_links_output.txt
