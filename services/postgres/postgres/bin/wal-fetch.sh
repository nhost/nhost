#!/bin/sh

# PostgreSQL treats a missing archived WAL (WAL-G exit 74) as end-of-archive.
# Other WAL-G failures (for example, an inaccessible archive) must abort
# recovery instead of silently promoting a truncated cluster.
if wal-g wal-fetch "$1" "$2"; then
	exit 0
else
	status=$?
fi
if [ "$status" -eq 74 ]; then
	exit 1
fi
echo "wal-fetch: archive fetch failed with code $status for $1" >&2
# A shell error in restore_command (126/127) is fatal to PostgreSQL recovery.
exit 126
