#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -P -- "$(dirname -- "$0")" && pwd -P)
HOOK=$SCRIPT_DIR/certbot-magicdns-auth-hook.sh
CERT_SCRIPT=$SCRIPT_DIR/cert.sh
REAL_JQ=$(command -v jq) || {
	echo "jq is required to run this harness" >&2
	exit 1
}

TMP_ROOT=${TMPDIR:-/tmp}/certbot-magicdns-hook-tests.$$
FAKE_BIN=$TMP_ROOT/bin
STATE=$TMP_ROOT/state.json
LOG=$TMP_ROOT/calls.log
CLOCK=$TMP_ROOT/clock
DIG_COUNT=$TMP_ROOT/dig-count
OUTPUT=$TMP_ROOT/output
CONFIG=$TMP_ROOT/config
mkdir -p "$FAKE_BIN"
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM

pass_count=0
fail_count=0

pass() {
	pass_count=$((pass_count + 1))
	printf 'ok %s - %s\n' "$pass_count" "$1"
}

fail_test() {
	fail_count=$((fail_count + 1))
	printf 'not ok %s - %s\n' "$((pass_count + fail_count))" "$1" >&2
}

assert_contains() {
	file=$1
	text=$2
	grep -F -- "$text" "$file" >/dev/null 2>&1
}

assert_not_contains() {
	file=$1
	text=$2
	! grep -F "$text" "$file" >/dev/null 2>&1
}

mapped_names='ACME_CHALLENGE_AI ACME_CHALLENGE_AUTH ACME_CHALLENGE_DASHBOARD ACME_CHALLENGE_DB ACME_CHALLENGE_FUNCTIONS ACME_CHALLENGE_GRAPHQL ACME_CHALLENGE_HASURA ACME_CHALLENGE_MAILHOG ACME_CHALLENGE_STORAGE'
domains='ai.local.nhost.run auth.local.nhost.run dashboard.local.nhost.run db.local.nhost.run functions.local.nhost.run graphql.local.nhost.run hasura.local.nhost.run mailhog.local.nhost.run storage.local.nhost.run'

make_state() {
	"$REAL_JQ" -n '
      {
        metadata: {uid: "uid-1", generation: 7},
        spec: {template: {spec: {containers: [
          {name: "magicdns", env: [
            {name: "ACME_CHALLENGE_AI", value: "token-ai"},
            {name: "ACME_CHALLENGE_AUTH", value: "token-auth"},
            {name: "ACME_CHALLENGE_DASHBOARD", value: "token-dashboard"},
            {name: "ACME_CHALLENGE_DB", value: "token-db"},
            {name: "ACME_CHALLENGE_FUNCTIONS", value: "token-functions"},
            {name: "ACME_CHALLENGE_GRAPHQL", value: "token-graphql"},
            {name: "ACME_CHALLENGE_HASURA", value: "token-hasura"},
            {name: "ACME_CHALLENGE_MAILHOG", value: "token-mailhog"},
            {name: "ACME_CHALLENGE_STORAGE", value: "token-storage"}
          ]},
          {name: "sidecar", env: [{name: "UNRELATED", value: "keep"}]}
        ]}}},
        status: {observedGeneration: 7}
      }
    ' >"$STATE"
}

write_config() {
	key=$1
	value=$2
	tmp=$CONFIG.tmp
	# shellcheck disable=SC2016
	"$REAL_JQ" --arg key "$key" --arg value "$value" '. + {($key): $value}' "$CONFIG" >"$tmp"
	mv "$tmp" "$CONFIG"
}

reset_fixture() {
	: >"$LOG"
	echo 1000 >"$CLOCK"
	echo 0 >"$DIG_COUNT"
	echo '{}' >"$CONFIG"
	make_state
}

install_fakes() {
	ln -sf "$REAL_JQ" "$FAKE_BIN/jq"
	ln -sf "$(command -v cat)" "$FAKE_BIN/cat"
	ln -sf "$(command -v mv)" "$FAKE_BIN/mv"
	ln -sf "$(command -v dirname)" "$FAKE_BIN/dirname"
	ln -sf "$(command -v sed)" "$FAKE_BIN/sed"
	ln -sf /bin/sh "$FAKE_BIN/sh"
	cat >"$FAKE_BIN/kubectl" <<'FAKE_KUBECTL'
#!/bin/sh
set -eu
printf 'kubectl' >> "$TEST_LOG"
for arg do printf '\t%s' "$arg" >> "$TEST_LOG"; done
printf '\n' >> "$TEST_LOG"

config_value() {
    jq -r --arg key "$1" '.[$key] // ""' "$TEST_CONFIG"
}

namespace=
if [ "${1:-}" = -n ]; then
    namespace=${2:-}
    shift 2
fi
[ -n "$namespace" ] || exit 70

case "${1:-} ${2:-}" in
    'get deployment')
        count_file=$TEST_ROOT/get-count
        count=0
        [ ! -f "$count_file" ] || count=$(cat "$count_file")
        count=$((count + 1))
        echo "$count" > "$count_file"
        fail_get=$(config_value FAIL_GET)
        [ "$fail_get" != "$count" ] || exit 71
        json=$(cat "$TEST_STATE")
        if [ "$count" -eq 2 ]; then
            corrupt_var=$(config_value FINAL_CORRUPT_VAR)
            corrupt_kind=$(config_value FINAL_CORRUPT_KIND)
            if [ -n "$corrupt_var" ]; then
                case "$corrupt_kind" in
                    missing)
                        json=$(printf '%s' "$json" | jq --arg name "$corrupt_var" '(.spec.template.spec.containers[].env) |= map(select(.name != $name))')
                        ;;
                    empty)
                        json=$(printf '%s' "$json" | jq --arg name "$corrupt_var" '(.spec.template.spec.containers[].env[] | select(.name == $name)) = {name: $name, value: ""}')
                        ;;
                    duplicate)
                        json=$(printf '%s' "$json" | jq --arg name "$corrupt_var" '.spec.template.spec.containers[1].env += [{name: $name, value: "duplicate-secret"}]')
                        ;;
                    valueFrom)
                        json=$(printf '%s' "$json" | jq --arg name "$corrupt_var" '(.spec.template.spec.containers[].env[] | select(.name == $name)) = {name: $name, valueFrom: {secretKeyRef: {name: "x", key: "y"}}}')
                        ;;
                esac
            fi
        fi
        if [ "$count" -ge 3 ]; then
            post_mode=$(config_value POST_MODE)
            case "$post_mode" in
                uid) json=$(printf '%s' "$json" | jq '.metadata.uid = "uid-2"') ;;
                generation) json=$(printf '%s' "$json" | jq '.metadata.generation += 1') ;;
                lag) json=$(printf '%s' "$json" | jq '.status.observedGeneration = (.metadata.generation - 1)') ;;
            esac
        fi
        printf '%s\n' "$json"
        ;;
    'set env')
        shift 2
        resource=${1:-}
        containers=${2:-}
        assignment=${3:-}
        [ "${resource#deployment/}" != "$resource" ] || exit 72
        [ "${containers#--containers=}" != "$containers" ] || exit 73
        container=${containers#--containers=}
        variable=${assignment%%=*}
        value=${assignment#*=}
        tmp=$TEST_STATE.tmp
        jq --arg container "$container" --arg variable "$variable" --arg value "$value" '
          .metadata.generation += 1
          | .status.observedGeneration = .metadata.generation
          | (.spec.template.spec.containers[]
             | select(.name == $container).env[]
             | select(.name == $variable).value) = $value
        ' "$TEST_STATE" > "$tmp"
        mv "$tmp" "$TEST_STATE"
        ;;
    'rollout status')
        [ "$(config_value ROLLOUT_FAIL)" != 1 ] || exit 74
        ;;
    *) exit 75 ;;
esac
FAKE_KUBECTL

	cat >"$FAKE_BIN/dig" <<'FAKE_DIG'
#!/bin/sh
set -eu
printf 'dig' >> "$TEST_LOG"
for arg do printf '\t%s' "$arg" >> "$TEST_LOG"; done
printf '\n' >> "$TEST_LOG"
count=$(cat "$TEST_DIG_COUNT")
count=$((count + 1))
echo "$count" > "$TEST_DIG_COUNT"
mode=$(jq -r '.DIG_MODE // "immediate"' "$TEST_CONFIG")
[ "$mode" != error ] || exit 80
record=
for arg do
    case "$arg" in _acme-challenge.*) record=$arg ;; esac
done
case "$record" in
    _acme-challenge.ai.local.nhost.run) variable=ACME_CHALLENGE_AI ;;
    _acme-challenge.auth.local.nhost.run) variable=ACME_CHALLENGE_AUTH ;;
    _acme-challenge.dashboard.local.nhost.run) variable=ACME_CHALLENGE_DASHBOARD ;;
    _acme-challenge.db.local.nhost.run) variable=ACME_CHALLENGE_DB ;;
    _acme-challenge.functions.local.nhost.run) variable=ACME_CHALLENGE_FUNCTIONS ;;
    _acme-challenge.graphql.local.nhost.run) variable=ACME_CHALLENGE_GRAPHQL ;;
    _acme-challenge.hasura.local.nhost.run) variable=ACME_CHALLENGE_HASURA ;;
    _acme-challenge.mailhog.local.nhost.run) variable=ACME_CHALLENGE_MAILHOG ;;
    _acme-challenge.storage.local.nhost.run) variable=ACME_CHALLENGE_STORAGE ;;
    *) exit 81 ;;
esac
value=$(jq -r --arg name "$variable" '.spec.template.spec.containers[].env[] | select(.name == $name) | .value' "$TEST_STATE")
if [ "$mode" = mismatch ] || { [ "$mode" = delayed ] && [ "$count" -le 9 ]; }; then
    printf '"not-the-value"\n'
elif [ "$mode" = multiple ]; then
    printf '"wrong-answer"\n'
    jq -Rn --arg value "$value" '$value'
elif [ "$mode" = split ] && [ "$variable" = ACME_CHALLENGE_AI ]; then
    first=${value%??}
    last=${value#"$first"}
    first_json=$(jq -Rn --arg value "$first" '$value')
    last_json=$(jq -Rn --arg value "$last" '$value')
    printf '%s %s\n' "$first_json" "$last_json"
else
    jq -Rn --arg value "$value" '$value'
fi
FAKE_DIG

	cat >"$FAKE_BIN/date" <<'FAKE_DATE'
#!/bin/sh
set -eu
[ "${1:-}" = +%s ] || exit 90
cat "$TEST_CLOCK"
FAKE_DATE

	cat >"$FAKE_BIN/sleep" <<'FAKE_SLEEP'
#!/bin/sh
set -eu
printf 'sleep\t%s\n' "$1" >> "$TEST_LOG"
now=$(cat "$TEST_CLOCK")
echo $((now + $1)) > "$TEST_CLOCK"
FAKE_SLEEP

	chmod +x "$FAKE_BIN/kubectl" "$FAKE_BIN/dig" "$FAKE_BIN/date" "$FAKE_BIN/sleep"
}

run_hook() {
	domain=$1
	validation=$2
	remaining=$3
	hook_namespace=${HOOK_NAMESPACE:-test-namespace}
	hook_deployment=${HOOK_DEPLOYMENT:-magicdns}
	shift 3
	rm -f "$TMP_ROOT/get-count"
	env -i \
		PATH="$FAKE_BIN" \
		TEST_ROOT="$TMP_ROOT" TEST_STATE="$STATE" TEST_LOG="$LOG" \
		TEST_CONFIG="$CONFIG" TEST_CLOCK="$CLOCK" TEST_DIG_COUNT="$DIG_COUNT" \
		CERTBOT_DOMAIN="$domain" CERTBOT_VALIDATION="$validation" \
		CERTBOT_REMAINING_CHALLENGES="$remaining" \
		"$@" \
		/bin/sh "$HOOK" "$hook_namespace" "$hook_deployment" >"$OUTPUT" 2>&1
}

expect_success() {
	name=$1
	shift
	if "$@"; then pass "$name"; else
		fail_test "$name"
		cat "$OUTPUT" >&2
	fi
}

expect_failure() {
	name=$1
	shift
	if "$@"; then fail_test "$name"; else pass "$name"; fi
}

corrupt_state() {
	variable=$1
	kind=$2
	tmp=$STATE.tmp
	case "$kind" in
	missing)
		# shellcheck disable=SC2016
		"$REAL_JQ" --arg name "$variable" '(.spec.template.spec.containers[].env) |= map(select(.name != $name))' "$STATE" >"$tmp"
		;;
	empty)
		# shellcheck disable=SC2016
		"$REAL_JQ" --arg name "$variable" '(.spec.template.spec.containers[].env[] | select(.name == $name)) = {name: $name, value: ""}' "$STATE" >"$tmp"
		;;
	duplicate)
		# shellcheck disable=SC2016
		"$REAL_JQ" --arg name "$variable" '.spec.template.spec.containers[1].env += [{name: $name, value: "duplicate-secret"}]' "$STATE" >"$tmp"
		;;
	valueFrom)
		# shellcheck disable=SC2016
		"$REAL_JQ" --arg name "$variable" '(.spec.template.spec.containers[].env[] | select(.name == $name)) = {name: $name, valueFrom: {secretKeyRef: {name: "x", key: "y"}}}' "$STATE" >"$tmp"
		;;
	esac
	mv "$tmp" "$STATE"
}

install_fakes
reset_fixture

# Every exact mapping updates only its existing variable and returns before rollout/DNS.
# shellcheck disable=SC2086
set -- $domains
for variable in $mapped_names; do
	domain=$1
	shift
	reset_fixture
	if run_hook "$domain" "new-$variable" 1 &&
		[ "$(grep -c '^kubectl.*set[[:space:]]env' "$LOG")" -eq 1 ] &&
		assert_contains "$LOG" "$variable=new-$variable" &&
		! grep -E 'rollout|^dig' "$LOG" >/dev/null 2>&1; then
		pass "mapping $domain to $variable"
	else
		fail_test "mapping $domain to $variable"
	fi
done

# Near matches and Route53-style names fail before the first kubectl call.
for bad_domain in \
	'*.ai.local.nhost.run' AI.local.nhost.run ai.local.nhost.run.example arbitrary.example; do
	reset_fixture
	if ! run_hook "$bad_domain" hidden-token 1 && [ ! -s "$LOG" ]; then
		pass "reject near-match domain $bad_domain before Kubernetes"
	else
		fail_test "reject near-match domain $bad_domain before Kubernetes"
	fi
done
for service in ai auth dashboard db functions graphql hasura mailhog storage; do
	reset_fixture
	if ! run_hook "local.$service.nhost.run" hidden-token 1 && [ ! -s "$LOG" ]; then
		pass "reject Route53-style domain local.$service.nhost.run"
	else
		fail_test "reject Route53-style domain local.$service.nhost.run"
	fi
done

# Argument, environment, names, counters, timings, and resolver validation.
reset_fixture
if ! env -i PATH="$FAKE_BIN" /bin/sh "$HOOK" >"$OUTPUT" 2>&1; then pass "missing hook arguments"; else fail_test "missing hook arguments"; fi
for pair in 'Bad_namespace magicdns' 'test-namespace BadDeployment' 'test.namespace magicdns' 'test-namespace bad..name' 'test-namespace .bad' 'test-namespace bad.'; do
	reset_fixture
	# shellcheck disable=SC2086
	if ! env -i PATH="$FAKE_BIN" TEST_ROOT="$TMP_ROOT" TEST_STATE="$STATE" TEST_LOG="$LOG" TEST_CONFIG="$CONFIG" TEST_CLOCK="$CLOCK" TEST_DIG_COUNT="$DIG_COUNT" CERTBOT_DOMAIN=ai.local.nhost.run CERTBOT_VALIDATION=x CERTBOT_REMAINING_CHALLENGES=1 /bin/sh "$HOOK" $pair >"$OUTPUT" 2>&1 && [ ! -s "$LOG" ]; then
		pass "invalid Kubernetes target $pair"
	else
		fail_test "invalid Kubernetes target $pair"
	fi
done
reset_fixture
if (HOOK_DEPLOYMENT=magicdns.prod run_hook ai.local.nhost.run hidden-token 1); then pass "Deployment DNS-subdomain permits dots"; else fail_test "Deployment DNS-subdomain permits dots"; fi
long_label=$(printf '%064d' 0)
reset_fixture
if ! (HOOK_DEPLOYMENT="$long_label.prod" run_hook ai.local.nhost.run hidden-token 1) && [ ! -s "$LOG" ]; then
	pass "Deployment DNS-subdomain rejects an overlong label"
else
	fail_test "Deployment DNS-subdomain rejects an overlong label"
fi
for missing in DOMAIN VALIDATION REMAINING; do
	reset_fixture
	case "$missing" in
	DOMAIN) command="env -i PATH=$FAKE_BIN TEST_ROOT=$TMP_ROOT TEST_STATE=$STATE TEST_LOG=$LOG TEST_CONFIG=$CONFIG TEST_CLOCK=$CLOCK TEST_DIG_COUNT=$DIG_COUNT CERTBOT_VALIDATION=x CERTBOT_REMAINING_CHALLENGES=1 /bin/sh $HOOK test-namespace magicdns" ;;
	VALIDATION) command="env -i PATH=$FAKE_BIN TEST_ROOT=$TMP_ROOT TEST_STATE=$STATE TEST_LOG=$LOG TEST_CONFIG=$CONFIG TEST_CLOCK=$CLOCK TEST_DIG_COUNT=$DIG_COUNT CERTBOT_DOMAIN=ai.local.nhost.run CERTBOT_REMAINING_CHALLENGES=1 /bin/sh $HOOK test-namespace magicdns" ;;
	REMAINING) command="env -i PATH=$FAKE_BIN TEST_ROOT=$TMP_ROOT TEST_STATE=$STATE TEST_LOG=$LOG TEST_CONFIG=$CONFIG TEST_CLOCK=$CLOCK TEST_DIG_COUNT=$DIG_COUNT CERTBOT_DOMAIN=ai.local.nhost.run CERTBOT_VALIDATION=x /bin/sh $HOOK test-namespace magicdns" ;;
	esac
	if ! sh -c "$command" >"$OUTPUT" 2>&1 && [ ! -s "$LOG" ]; then pass "missing CERTBOT_$missing"; else fail_test "missing CERTBOT_$missing"; fi
done
for bad in -1 +1 1.5 ' 1' 999999999999999999999; do
	reset_fixture
	if ! run_hook ai.local.nhost.run hidden-token "$bad" && [ ! -s "$LOG" ]; then pass "invalid remaining counter $bad"; else fail_test "invalid remaining counter $bad"; fi
done
for timing in ACME_ROLLOUT_TIMEOUT_SECONDS ACME_DNS_TIMEOUT_SECONDS ACME_DNS_POLL_INTERVAL_SECONDS; do
	for bad in '' 0 -1 +1 1.5 ' 1' 2147483648; do
		reset_fixture
		if ! run_hook ai.local.nhost.run hidden-token 1 "$timing=$bad" && [ ! -s "$LOG" ]; then pass "invalid $timing=$bad"; else fail_test "invalid $timing=$bad"; fi
	done
done
for resolver in '@1.1.1.1' '1.1.1.1 -p 54' '1.1.1.1#54' '.resolver' 'resolver.'; do
	reset_fixture
	if ! run_hook ai.local.nhost.run hidden-token 1 "ACME_DNS_SERVER=$resolver" && [ ! -s "$LOG" ]; then pass "invalid resolver $resolver"; else fail_test "invalid resolver $resolver"; fi
done

# Every mapped variable fails closed for each unsupported Deployment layout.
# shellcheck disable=SC2086
set -- $domains
for variable in $mapped_names; do
	domain=$1
	shift
	for kind in missing empty duplicate valueFrom; do
		reset_fixture
		corrupt_state "$variable" "$kind"
		if ! run_hook "$domain" hidden-token 1 &&
			! grep 'set[[:space:]]env' "$LOG" >/dev/null 2>&1 &&
			assert_contains "$OUTPUT" "$variable" &&
			assert_not_contains "$OUTPUT" hidden-token &&
			assert_not_contains "$OUTPUT" duplicate-secret; then
			pass "current $variable rejects $kind layout"
		else
			fail_test "current $variable rejects $kind layout"
		fi
	done
done

# A short-count final hook revalidates every retained variable after patching.
for variable in $mapped_names; do
	for kind in missing empty duplicate valueFrom; do
		reset_fixture
		write_config FINAL_CORRUPT_VAR "$variable"
		write_config FINAL_CORRUPT_KIND "$kind"
		if ! run_hook ai.local.nhost.run final-ai 0 &&
			[ "$(grep -c '^kubectl.*set[[:space:]]env' "$LOG")" -eq 1 ] &&
			! grep -E 'rollout|^dig' "$LOG" >/dev/null 2>&1 &&
			assert_contains "$OUTPUT" "$variable" &&
			assert_not_contains "$OUTPUT" final-ai &&
			assert_not_contains "$OUTPUT" duplicate-secret; then
			pass "final retained $variable rejects $kind layout"
		else
			fail_test "final retained $variable rejects $kind layout"
		fi
	done
done

# Final sequencing, rollout guards, DNS parsing, retries, resolver handling, and deadline.
reset_fixture
if run_hook ai.local.nhost.run final-ai 0 ACME_ROLLOUT_TIMEOUT_SECONDS=17 &&
	[ "$(grep -c 'rollout[[:space:]]status' "$LOG")" -eq 1 ] &&
	[ "$(grep -c '^kubectl.*get[[:space:]]deployment' "$LOG")" -eq 3 ] &&
	assert_contains "$LOG" '--timeout=17s' &&
	[ "$(grep -c '^dig' "$LOG")" -eq 9 ] &&
	! grep '^dig[[:space:]]@' "$LOG" >/dev/null 2>&1 &&
	assert_not_contains "$OUTPUT" final-ai &&
	assert_not_contains "$OUTPUT" token-ai &&
	[ "$(grep -n 'rollout' "$LOG" | cut -d: -f1)" -lt "$(grep -n '^dig' "$LOG" | head -1 | cut -d: -f1)" ]; then
	pass "final hook rolls out exactly once before one complete DNS sweep"
else
	fail_test "final hook rolls out exactly once before one complete DNS sweep"
	cat "$OUTPUT" >&2
fi

reset_fixture
if run_hook ai.local.nhost.run final-ai 0 ACME_DNS_SERVER=1.1.1.1 &&
	[ "$(grep -c '^dig[[:space:]]@1.1.1.1' "$LOG")" -eq 9 ] &&
	! grep -E '(^|[[:space:]])-p([[:space:]]|$)' "$LOG" >/dev/null 2>&1; then
	pass "resolver override is one @server argument on port 53"
else
	fail_test "resolver override is one @server argument on port 53"
fi

for mode in multiple split; do
	reset_fixture
	write_config DIG_MODE "$mode"
	expect_success "normalized $mode TXT answers" run_hook ai.local.nhost.run final-ai 0
done

reset_fixture
write_config DIG_MODE delayed
if run_hook ai.local.nhost.run final-ai 0 &&
	[ "$(grep -c '^dig' "$LOG")" -eq 18 ] &&
	assert_contains "$LOG" '+time=1' &&
	assert_contains "$LOG" '+tries=1' &&
	assert_contains "$LOG" 'sleep'; then pass "delayed DNS converges in complete bounded sweeps"; else
	fail_test "delayed DNS converges in complete bounded sweeps"
	cat "$OUTPUT" >&2
fi

for mode in mismatch error; do
	reset_fixture
	write_config DIG_MODE "$mode"
	if ! run_hook ai.local.nhost.run final-ai 0 ACME_DNS_TIMEOUT_SECONDS=3 ACME_DNS_POLL_INTERVAL_SECONDS=2 &&
		[ "$(grep -c '^dig' "$LOG")" -eq 18 ] &&
		assert_contains "$LOG" 'sleep	2' &&
		assert_contains "$LOG" 'sleep	1'; then pass "$mode DNS response respects global deadline with capped sleeps"; else fail_test "$mode DNS response respects global deadline with capped sleeps"; fi
done

for post_mode in uid generation lag; do
	reset_fixture
	write_config POST_MODE "$post_mode"
	if ! run_hook ai.local.nhost.run final-ai 0 &&
		[ "$(grep -c 'rollout[[:space:]]status' "$LOG")" -eq 1 ] &&
		! grep '^dig' "$LOG" >/dev/null 2>&1; then pass "post-rollout $post_mode guard prevents DNS"; else fail_test "post-rollout $post_mode guard prevents DNS"; fi
done

reset_fixture
write_config ROLLOUT_FAIL 1
if ! run_hook ai.local.nhost.run final-ai 0 &&
	[ "$(grep -c 'rollout[[:space:]]status' "$LOG")" -eq 1 ] &&
	! grep '^dig' "$LOG" >/dev/null 2>&1; then pass "rollout failure prevents DNS"; else fail_test "rollout failure prevents DNS"; fi

for get_number in 1 2 3; do
	reset_fixture
	write_config FAIL_GET "$get_number"
	if ! run_hook ai.local.nhost.run final-ai 0; then pass "Deployment read $get_number failure is explicit"; else fail_test "Deployment read $get_number failure is explicit"; fi
done

# Missing command preflights occur before Kubernetes mutation.
for missing_command in kubectl jq dig date sleep; do
	reset_fixture
	saved=$FAKE_BIN/$missing_command.saved
	mv "$FAKE_BIN/$missing_command" "$saved"
	if ! run_hook ai.local.nhost.run hidden-token 1 && ! grep 'set[[:space:]]env' "$LOG" >/dev/null 2>&1; then
		pass "missing $missing_command preflight"
	else
		fail_test "missing $missing_command preflight"
	fi
	mv "$saved" "$FAKE_BIN/$missing_command"
done

# No context override, no token output, and no production token-state file.
reset_fixture
if run_hook ai.local.nhost.run output-secret-token 1 &&
	! grep -- '--context' "$LOG" >/dev/null 2>&1 &&
	assert_not_contains "$OUTPUT" output-secret-token &&
	[ ! -e "$TMP_ROOT/token-state" ]; then
	pass "current context and output/state hygiene"
else
	fail_test "current context and output/state hygiene"
fi

# cert.sh integration: fake Certbot executes the serialized hook through sh -c.
cat >"$FAKE_BIN/certbot" <<'FAKE_CERTBOT'
#!/bin/sh
set -eu
printf 'certbot' >> "$TEST_LOG"
hook=
previous=
for arg do
    printf '\t%s' "$arg" >> "$TEST_LOG"
    if [ "$previous" = --manual-auth-hook ]; then hook=$arg; fi
    previous=$arg
done
printf '\n' >> "$TEST_LOG"
if [ -n "$hook" ]; then
    # Certbot validates the first word literally before executing the shell command.
    command_word=${hook%%[[:space:]]*}
    command -v "$command_word" >/dev/null 2>&1 || exit 90
    CERTBOT_DOMAIN=ai.local.nhost.run CERTBOT_VALIDATION=integration-token CERTBOT_REMAINING_CHALLENGES=0 \
        sh -c "$hook"
fi
FAKE_CERTBOT
cat >"$FAKE_BIN/cp" <<'FAKE_CP'
#!/bin/sh
set -eu
printf 'cp\t%s\t%s\n' "$1" "$2" >> "$TEST_LOG"
FAKE_CP
cat >"$FAKE_BIN/rm" <<'FAKE_RM'
#!/bin/sh
set -eu
printf 'rm' >> "$TEST_LOG"
for arg do printf '\t%s' "$arg" >> "$TEST_LOG"; done
printf '\n' >> "$TEST_LOG"
FAKE_RM
chmod +x "$FAKE_BIN/certbot" "$FAKE_BIN/cp" "$FAKE_BIN/rm"

integration_repo=$TMP_ROOT/'repository with spaces'
mkdir -p "$integration_repo/cli"
cp "$CERT_SCRIPT" "$HOOK" "$integration_repo/cli/"
chmod +x "$integration_repo/cli/cert.sh" "$integration_repo/cli/certbot-magicdns-auth-hook.sh"
reset_fixture
if (cd "$integration_repo/cli" && env PATH="$FAKE_BIN" TEST_ROOT="$TMP_ROOT" TEST_STATE="$STATE" TEST_LOG="$LOG" TEST_CONFIG="$CONFIG" TEST_CLOCK="$CLOCK" TEST_DIG_COUNT="$DIG_COUNT" ./cert.sh test-namespace magicdns >"$OUTPUT" 2>&1) &&
	[ "$(grep -c '^certbot' "$LOG")" -eq 2 ] &&
	[ "$(grep -c -- '--manual-auth-hook' "$LOG")" -eq 1 ] &&
	! sed -n '1p' "$LOG" | grep -- '--manual-auth-hook' >/dev/null 2>&1 &&
	assert_contains "$LOG" 'ssl/.ssl/local-fullchain.pem' &&
	assert_contains "$LOG" 'ssl/.ssl/sub-fullchain.pem' &&
	grep '^rm.*letsencrypt' "$LOG" >/dev/null 2>&1 &&
	assert_contains "$LOG" 'ACME_CHALLENGE_AI=integration-token' &&
	assert_not_contains "$OUTPUT" integration-token; then pass "cert.sh serialized hook executes from a path with spaces"; else
	fail_test "cert.sh serialized hook executes from a path with spaces"
	cat "$OUTPUT" >&2
fi

other_cwd=$TMP_ROOT/prepared-cwd
mkdir -p "$other_cwd"
reset_fixture
if (cd "$other_cwd" && env PATH="$FAKE_BIN" TEST_ROOT="$TMP_ROOT" TEST_STATE="$STATE" TEST_LOG="$LOG" TEST_CONFIG="$CONFIG" TEST_CLOCK="$CLOCK" TEST_DIG_COUNT="$DIG_COUNT" "$integration_repo/cli/cert.sh" test-namespace magicdns >"$OUTPUT" 2>&1) &&
	assert_contains "$LOG" 'letsencrypt/live/local.ai.nhost.run/fullchain.pem' &&
	assert_contains "$LOG" 'ssl/.ssl/local-fullchain.pem'; then
	pass "cert.sh preserves caller working-directory relative paths"
else
	fail_test "cert.sh preserves caller working-directory relative paths"
fi

# cert.sh rejects invalid targets before invoking Certbot.
reset_fixture
if ! (cd "$integration_repo/cli" && env PATH="$FAKE_BIN" ./cert.sh invalid_namespace magicdns >"$OUTPUT" 2>&1) &&
	[ ! -s "$LOG" ]; then pass "cert.sh validates target before Certbot"; else fail_test "cert.sh validates target before Certbot"; fi

printf '1..%s\n' "$((pass_count + fail_count))"
if [ "$fail_count" -ne 0 ]; then
	printf '%s test(s) failed\n' "$fail_count" >&2
	exit 1
fi
printf '%s tests passed\n' "$pass_count"
