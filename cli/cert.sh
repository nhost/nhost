#!/bin/sh

set -euo pipefail

usage() {
	echo "Usage: $0 <namespace> <deployment>" >&2
}

fail() {
	echo "certbot magicdns auth hook: $1" >&2
	exit 1
}

validate_dns_label() {
	value=$1
	[ -n "$value" ] || return 1
	[ "${#value}" -le 63 ] || return 1
	case "$value" in
	*[!a-z0-9-]* | -* | *-) return 1 ;;
	esac
}

validate_dns_subdomain() {
	subdomain=$1
	[ -n "$subdomain" ] || return 1
	[ "${#subdomain}" -le 253 ] || return 1
	case "$subdomain" in
	.* | *. | *..*) return 1 ;;
	esac
	while [ "${subdomain#*.}" != "$subdomain" ]; do
		validate_dns_label "${subdomain%%.*}" || return 1
		subdomain=${subdomain#*.}
	done
	validate_dns_label "$subdomain"
}

normalize_uint() {
	number=$1
	allow_zero=$2
	case "$number" in
	'' | *[!0-9]*) return 1 ;;
	esac
	while [ "${number#0}" != "$number" ]; do
		number=${number#0}
	done
	[ -n "$number" ] || number=0
	[ "${#number}" -le 10 ] || return 1
	if [ "${#number}" -eq 10 ] && [ "$number" -gt 2147483647 ]; then
		return 1
	fi
	if [ "$allow_zero" -eq 0 ] && [ "$number" -eq 0 ]; then
		return 1
	fi
	NORMALIZED_UINT=$number
}

validate_resolver() {
	server=$1
	[ -n "$server" ] || return 0
	[ "${#server}" -le 253 ] || return 1
	case "$server" in
	*[!A-Za-z0-9.-]* | .* | *. | *..* | -* | *-) return 1 ;;
	esac
}

require_command() {
	command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

read_deployment() {
	if ! DEPLOYMENT_JSON=$(kubectl -n "$namespace" get deployment "$deployment" -o json 2>/dev/null); then
		fail "could not read Deployment"
	fi
}

validate_mapped_variable() {
	mapped_name=$1
	if ! printf '%s' "$DEPLOYMENT_JSON" | jq -e --arg name "$mapped_name" '
        [.spec.template.spec.containers[]? as $container
          | ($container.env // [])[]?
          | select(.name == $name)
          | {container: $container.name, entry: .}]
        | length == 1
          and (.[0].container | type == "string" and length > 0)
          and (.[0].entry | has("value"))
          and (.[0].entry.value | type == "string" and length > 0)
          and (.[0].entry | has("valueFrom") | not)
    ' >/dev/null 2>&1; then
		fail "Deployment variable $mapped_name must exist exactly once as a direct non-empty value"
	fi
}

mapped_container() {
	printf '%s' "$DEPLOYMENT_JSON" | jq -er --arg name "$1" '
        .spec.template.spec.containers[]
        | select(any((.env // [])[]; .name == $name))
        | .name
    ' 2>/dev/null
}

mapped_value() {
	printf '%s' "$DEPLOYMENT_JSON" | jq -er --arg name "$1" '
        .spec.template.spec.containers[]
        | (.env // [])[]
        | select(.name == $name)
        | .value
    ' 2>/dev/null
}

dns_record_matches() {
	expected=$1
	printf '%s\n' "$DIG_OUTPUT" | jq -Rse --arg expected "$expected" '
        split("\n")
        | map(select(length > 0))
        | any(.[];
            test("^[[:space:]]*\\\"(?:[^\\\"\\\\]|\\\\.)*\\\"(?:[[:space:]]+\\\"(?:[^\\\"\\\\]|\\\\.)*\\\")*[[:space:]]*$")
            and ([scan("\\\"(?:[^\\\"\\\\]|\\\\.)*\\\"") | fromjson] | add == $expected)
          )
    ' >/dev/null 2>&1
}

quote_for_shell() {
	printf "'"
	printf '%s' "$1" | sed "s/'/'\\\\''/g"
	printf "'"
}

certbot_auth_hook() {
	if [ "$#" -ne 2 ]; then
		fail "expected Kubernetes namespace and Deployment name"
	fi

	namespace=$1
	deployment=$2
	validate_dns_label "$namespace" || fail "invalid Kubernetes namespace"
	validate_dns_subdomain "$deployment" || fail "invalid Kubernetes Deployment name"

	[ "${CERTBOT_DOMAIN+x}" = x ] && [ -n "$CERTBOT_DOMAIN" ] || fail "CERTBOT_DOMAIN is required"
	[ "${CERTBOT_VALIDATION+x}" = x ] && [ -n "$CERTBOT_VALIDATION" ] || fail "CERTBOT_VALIDATION is required"
	[ "${CERTBOT_REMAINING_CHALLENGES+x}" = x ] || fail "CERTBOT_REMAINING_CHALLENGES is required"

	case "$CERTBOT_DOMAIN" in
	ai.local.nhost.run) mapped_variable=ACME_CHALLENGE_AI ;;
	auth.local.nhost.run) mapped_variable=ACME_CHALLENGE_AUTH ;;
	dashboard.local.nhost.run) mapped_variable=ACME_CHALLENGE_DASHBOARD ;;
	db.local.nhost.run) mapped_variable=ACME_CHALLENGE_DB ;;
	functions.local.nhost.run) mapped_variable=ACME_CHALLENGE_FUNCTIONS ;;
	graphql.local.nhost.run) mapped_variable=ACME_CHALLENGE_GRAPHQL ;;
	hasura.local.nhost.run) mapped_variable=ACME_CHALLENGE_HASURA ;;
	mailhog.local.nhost.run) mapped_variable=ACME_CHALLENGE_MAILHOG ;;
	storage.local.nhost.run) mapped_variable=ACME_CHALLENGE_STORAGE ;;
	*) fail "unsupported Certbot domain" ;;
	esac

	normalize_uint "$CERTBOT_REMAINING_CHALLENGES" 1 || fail "CERTBOT_REMAINING_CHALLENGES must be a non-negative base-10 integer"
	remaining_challenges=$NORMALIZED_UINT

	ACME_ROLLOUT_TIMEOUT_SECONDS=${ACME_ROLLOUT_TIMEOUT_SECONDS-300}
	ACME_DNS_TIMEOUT_SECONDS=${ACME_DNS_TIMEOUT_SECONDS-300}
	ACME_DNS_POLL_INTERVAL_SECONDS=${ACME_DNS_POLL_INTERVAL_SECONDS-2}
	ACME_DNS_SERVER=${ACME_DNS_SERVER:-}

	normalize_uint "$ACME_ROLLOUT_TIMEOUT_SECONDS" 0 || fail "ACME_ROLLOUT_TIMEOUT_SECONDS must be a positive base-10 integer"
	rollout_timeout=$NORMALIZED_UINT
	normalize_uint "$ACME_DNS_TIMEOUT_SECONDS" 0 || fail "ACME_DNS_TIMEOUT_SECONDS must be a positive base-10 integer"
	dns_timeout=$NORMALIZED_UINT
	normalize_uint "$ACME_DNS_POLL_INTERVAL_SECONDS" 0 || fail "ACME_DNS_POLL_INTERVAL_SECONDS must be a positive base-10 integer"
	poll_interval=$NORMALIZED_UINT
	validate_resolver "$ACME_DNS_SERVER" || fail "ACME_DNS_SERVER must be a hostname or IPv4 address for port 53"

	require_command kubectl
	require_command jq
	require_command dig
	require_command date
	require_command sleep

	read_deployment
	validate_mapped_variable "$mapped_variable"
	if ! container=$(mapped_container "$mapped_variable"); then
		fail "could not identify the container for $mapped_variable"
	fi

	if ! kubectl -n "$namespace" set env "deployment/$deployment" --containers="$container" \
		"$mapped_variable=$CERTBOT_VALIDATION" >/dev/null 2>&1; then
		fail "could not update Deployment variable $mapped_variable"
	fi
	echo "Published challenge for $CERTBOT_DOMAIN"

	if [ "$remaining_challenges" -ne 0 ]; then
		exit 0
	fi

	read_deployment
	for variable in \
		ACME_CHALLENGE_AI \
		ACME_CHALLENGE_AUTH \
		ACME_CHALLENGE_DASHBOARD \
		ACME_CHALLENGE_DB \
		ACME_CHALLENGE_FUNCTIONS \
		ACME_CHALLENGE_GRAPHQL \
		ACME_CHALLENGE_HASURA \
		ACME_CHALLENGE_MAILHOG \
		ACME_CHALLENGE_STORAGE; do
		validate_mapped_variable "$variable"
	done

	if ! challenge_ai=$(mapped_value ACME_CHALLENGE_AI) ||
		! challenge_auth=$(mapped_value ACME_CHALLENGE_AUTH) ||
		! challenge_dashboard=$(mapped_value ACME_CHALLENGE_DASHBOARD) ||
		! challenge_db=$(mapped_value ACME_CHALLENGE_DB) ||
		! challenge_functions=$(mapped_value ACME_CHALLENGE_FUNCTIONS) ||
		! challenge_graphql=$(mapped_value ACME_CHALLENGE_GRAPHQL) ||
		! challenge_hasura=$(mapped_value ACME_CHALLENGE_HASURA) ||
		! challenge_mailhog=$(mapped_value ACME_CHALLENGE_MAILHOG) ||
		! challenge_storage=$(mapped_value ACME_CHALLENGE_STORAGE); then
		fail "could not capture Deployment challenge values"
	fi

	if ! deployment_uid=$(printf '%s' "$DEPLOYMENT_JSON" | jq -er '.metadata.uid | select(type == "string" and length > 0)' 2>/dev/null) ||
		! deployment_generation=$(printf '%s' "$DEPLOYMENT_JSON" | jq -er '.metadata.generation | select(type == "number" and floor == . and . > 0)' 2>/dev/null); then
		fail "Deployment identity or generation is invalid"
	fi
	normalize_uint "$deployment_generation" 0 || fail "Deployment generation is outside the supported range"
	deployment_generation=$NORMALIZED_UINT

	if ! kubectl -n "$namespace" rollout status "deployment/$deployment" \
		--timeout="${rollout_timeout}s" >/dev/null 2>&1; then
		fail "Deployment rollout did not converge"
	fi

	read_deployment
	if ! printf '%s' "$DEPLOYMENT_JSON" | jq -e \
		--arg uid "$deployment_uid" \
		--argjson generation "$deployment_generation" '
	        .metadata.uid == $uid
	        and .metadata.generation == $generation
	        and (.status.observedGeneration | type == "number" and floor == . and . >= $generation)
	    ' >/dev/null 2>&1; then
		fail "Deployment changed or was not observed at the captured generation"
	fi

	if ! started_at=$(date +%s 2>/dev/null); then
		fail "could not read the system clock"
	fi
	normalize_uint "$started_at" 1 || fail "system clock returned an invalid value"
	started_at=$NORMALIZED_UINT
	deadline=$((started_at + dns_timeout))

	while :; do
		all_ready=1
		for record_and_value in \
			"_acme-challenge.ai.local.nhost.run|$challenge_ai" \
			"_acme-challenge.auth.local.nhost.run|$challenge_auth" \
			"_acme-challenge.dashboard.local.nhost.run|$challenge_dashboard" \
			"_acme-challenge.db.local.nhost.run|$challenge_db" \
			"_acme-challenge.functions.local.nhost.run|$challenge_functions" \
			"_acme-challenge.graphql.local.nhost.run|$challenge_graphql" \
			"_acme-challenge.hasura.local.nhost.run|$challenge_hasura" \
			"_acme-challenge.mailhog.local.nhost.run|$challenge_mailhog" \
			"_acme-challenge.storage.local.nhost.run|$challenge_storage"; do
			record=${record_and_value%%|*}
			expected=${record_and_value#*|}
			if ! now=$(date +%s 2>/dev/null); then
				fail "could not read the system clock"
			fi
			normalize_uint "$now" 1 || fail "system clock returned an invalid value"
			now=$NORMALIZED_UINT
			if [ "$now" -ge "$deadline" ]; then
				all_ready=0
				echo "DNS deadline reached before querying $record" >&2
				continue
			fi

			if [ -n "$ACME_DNS_SERVER" ]; then
				if DIG_OUTPUT=$(dig "@$ACME_DNS_SERVER" +time=1 +tries=1 +short TXT "$record" 2>/dev/null); then
					dig_ok=1
				else
					dig_ok=0
				fi
			else
				if DIG_OUTPUT=$(dig +time=1 +tries=1 +short TXT "$record" 2>/dev/null); then
					dig_ok=1
				else
					dig_ok=0
				fi
			fi

			if [ "$dig_ok" -eq 1 ] && dns_record_matches "$expected"; then
				echo "DNS record $record is ready"
			else
				all_ready=0
				echo "DNS record $record is pending" >&2
			fi
		done

		if [ "$all_ready" -eq 1 ]; then
			echo "All magicdns ACME challenge records are ready"
			exit 0
		fi

		if ! now=$(date +%s 2>/dev/null); then
			fail "could not read the system clock"
		fi
		normalize_uint "$now" 1 || fail "system clock returned an invalid value"
		now=$NORMALIZED_UINT
		if [ "$now" -ge "$deadline" ]; then
			fail "DNS challenge records did not converge before the deadline"
		fi
		remaining_time=$((deadline - now))
		sleep_for=$poll_interval
		if [ "$sleep_for" -gt "$remaining_time" ]; then
			sleep_for=$remaining_time
		fi
		if ! sleep "$sleep_for"; then
			fail "DNS polling sleep failed"
		fi
	done
}

if [ "${1:-}" = --certbot-auth-hook ]; then
	shift
	certbot_auth_hook "$@"
	exit 0
fi

if [ "$#" -ne 2 ]; then
	usage
	exit 2
fi

namespace=$1
deployment=$2
if ! validate_dns_label "$namespace"; then
	echo "Invalid Kubernetes namespace" >&2
	exit 2
fi
if ! validate_dns_subdomain "$deployment"; then
	echo "Invalid Kubernetes Deployment name" >&2
	exit 2
fi

if ! script_dir=$(CDPATH='' cd -P -- "$(dirname -- "$0")" 2>/dev/null && pwd -P); then
	echo "Could not resolve cert.sh directory" >&2
	exit 1
fi
script_path=$script_dir/cert.sh
# Certbot validates the first word without shell-unquoting it, so keep sh literal.
auth_hook_command="sh $(quote_for_shell "$script_path") --certbot-auth-hook $(quote_for_shell "$namespace") $(quote_for_shell "$deployment")"

certbot certonly \
	-v \
	--dns-route53 \
	-d local.ai.nhost.run \
	-d local.auth.nhost.run \
	-d local.dashboard.nhost.run \
	-d local.db.nhost.run \
	-d local.functions.nhost.run \
	-d local.graphql.nhost.run \
	-d local.hasura.nhost.run \
	-d local.mailhog.nhost.run \
	-d local.storage.nhost.run \
	-m 'admin@nhost.io' \
	--non-interactive \
	--agree-tos \
	--server https://acme-v02.api.letsencrypt.org/directory \
	--logs-dir letsencrypt \
	--config-dir letsencrypt \
	--work-dir letsencrypt

cp letsencrypt/live/local.ai.nhost.run/fullchain.pem ssl/.ssl/local-fullchain.pem
cp letsencrypt/live/local.ai.nhost.run/privkey.pem ssl/.ssl/local-privkey.pem

certbot certonly \
	-v \
	--manual \
	--preferred-challenges dns \
	--manual-auth-hook "$auth_hook_command" \
	-d *.ai.local.nhost.run \
	-d *.auth.local.nhost.run \
	-d *.dashboard.local.nhost.run \
	-d *.db.local.nhost.run \
	-d *.functions.local.nhost.run \
	-d *.graphql.local.nhost.run \
	-d *.hasura.local.nhost.run \
	-d *.mailhog.local.nhost.run \
	-d *.storage.local.nhost.run \
	-m 'admin@nhost.io' \
	--agree-tos \
	--server https://acme-v02.api.letsencrypt.org/directory \
	--logs-dir letsencrypt \
	--config-dir letsencrypt \
	--work-dir letsencrypt

cp letsencrypt/live/ai.local.nhost.run/fullchain.pem ssl/.ssl/sub-fullchain.pem
cp letsencrypt/live/ai.local.nhost.run/privkey.pem ssl/.ssl/sub-privkey.pem

rm -rf letsencrypt
