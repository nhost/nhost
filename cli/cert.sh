#!/bin/sh

set -euo pipefail

usage() {
	echo "Usage: $0 <namespace> <deployment>" >&2
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

quote_for_shell() {
	printf "'"
	printf '%s' "$1" | sed "s/'/'\\\\''/g"
	printf "'"
}

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
hook_path=$script_dir/certbot-magicdns-auth-hook.sh
auth_hook_command="$(quote_for_shell "$hook_path") $(quote_for_shell "$namespace") $(quote_for_shell "$deployment")"

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
