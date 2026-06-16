#!/bin/bash
# Smoke test for the dashboard-parity ops on POST /v1/metadata.
# Exercises one representative op per dashboard tab against a running
# constellation in DB-source mode (`make run-up-dbsource`). Not a
# replacement for clicking through the dashboard manually — this just
# proves the wire surface is reachable end to end.
#
# Usage:
#   ./scripts/smoke_dashboard_parity.sh                 # localhost:8000
#   CONSTELLATION_URL=http://other:8000 ./scripts/smoke_dashboard_parity.sh
#
# Exits 1 on the first regression: a non-2xx response, a 2xx body that carries
# an error `code` field, or a 2xx body whose `message` (single op or bulk slot)
# is anything other than `success` / an expected idempotency outcome
# (`already-tracked`, `already-exists`).

set -euo pipefail

URL="${CONSTELLATION_URL:-http://localhost:8000}/v1/metadata"
SECRET="${CONSTELLATION_ADMIN_SECRET:-nhost-admin-secret}"

body_file=$(mktemp)
trap 'rm -f "$body_file"' EXIT

call() {
    local label="$1"
    local body="$2"

    local out status_body
    out=$(curl -sS -o "$body_file" -w '%{http_code}' \
        -H 'Content-Type: application/json' \
        -H "X-Hasura-Admin-Secret: $SECRET" \
        -d "$body" "$URL") || {
            echo "  $label: curl FAILED"
            exit 1
        }

    status_body=$(head -c 200 "$body_file" | tr -d '\n')
    printf '  [%s] %-44s %s\n' "$out" "$label" "$status_body"

    if [[ ! $out =~ ^2 ]]; then
        echo "FAIL: $label returned HTTP $out"
        exit 1
    fi

    # A 2xx response must not smuggle an error `code` field, and every
    # `message` it carries (single op or bulk slot) must be a success /
    # idempotent outcome. These are the regression signals the README
    # documents; without them a 200 error body would pass silently.
    if grep -q '"code"' "$body_file"; then
        echo "FAIL: $label returned an error code in an HTTP $out body: $status_body"
        exit 1
    fi

    local bad_msg
    bad_msg=$(grep -oE '"message":"[^"]*"' "$body_file" \
        | grep -vE '"message":"(success|already-tracked|already-exists)"' || true)
    if [[ -n $bad_msg ]]; then
        echo "FAIL: $label returned unexpected message(s): $bad_msg"
        exit 1
    fi
}

echo "Target: $URL"
echo

echo "== Tables =="
call pg_track_table \
    '{"type":"pg_track_table","args":{"source":"default","table":{"schema":"public","name":"smoke_users"}}}'
call 'pg_track_table (idempotent re-track)' \
    '{"type":"pg_track_table","args":{"source":"default","table":{"schema":"public","name":"smoke_users"}}}'
call pg_set_table_customization \
    '{"type":"pg_set_table_customization","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"configuration":{"custom_name":"SmokeUsers"}}}'

echo
echo "== Permissions (one per verb) =="
for verb in select insert update delete; do
    if [[ $verb == insert ]]; then
        body='"check":{}'
    else
        body='"filter":{}'
    fi
    call "pg_create_${verb}_permission" \
        "{\"type\":\"pg_create_${verb}_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"smoke_users\"},\"role\":\"smoke\",\"permission\":{\"columns\":[\"id\"],${body}}}}"
done

echo
echo "== bulk_atomic (4 perms drop in one write) =="
call bulk_atomic \
    '{"type":"bulk_atomic","args":[
        {"type":"pg_drop_select_permission","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"role":"smoke"}},
        {"type":"pg_drop_insert_permission","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"role":"smoke"}},
        {"type":"pg_drop_update_permission","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"role":"smoke"}},
        {"type":"pg_drop_delete_permission","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"role":"smoke"}}
    ]}'

echo
echo "== Reads =="
call pg_suggest_relationships \
    '{"type":"pg_suggest_relationships","args":{"source":"default"}}'

echo
echo "== Snapshot ops =="
call reload_metadata '{"type":"reload_metadata","args":{}}'

echo
echo "== Event triggers (config + runtime) =="
call pg_create_event_trigger \
    '{"type":"pg_create_event_trigger","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"name":"smoke_trigger","definition":{"insert":{"columns":"*"}},"webhook":"https://example.com","retry_conf":{"num_retries":0,"interval_sec":10}}}'
echo '  (next call expects HTTP 400 with not-supported)'
out=$(curl -sS -o "$body_file" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -H "X-Hasura-Admin-Secret: $SECRET" \
    -d '{"type":"pg_redeliver_event","args":{"event_id":"x"}}' "$URL") || {
        echo "  pg_redeliver_event: curl FAILED"
        exit 1
    }
body=$(head -c 200 "$body_file" | tr -d '\n')
printf '  [%s] %-44s %s\n' "$out" "pg_redeliver_event (expect 400)" "$body"
if [[ $out != 400 ]] || ! grep -q 'not-supported' "$body_file"; then
    echo "FAIL: expected 400 not-supported for runtime event op"
    exit 1
fi

echo
echo "== Cleanup =="
call 'pg_delete_event_trigger' \
    '{"type":"pg_delete_event_trigger","args":{"source":"default","table":{"schema":"public","name":"smoke_users"},"name":"smoke_trigger"}}'
call 'pg_untrack_table' \
    '{"type":"pg_untrack_table","args":{"source":"default","table":{"schema":"public","name":"smoke_users"}}}'

echo
echo "All smoke ops succeeded."
