#!/bin/sh
set -eu

server_path=/var/lib/postgresql/pg_durable_http_test_responder
pid_file=/var/lib/postgresql/pg_durable_http_test_server.pid
log_file=/var/lib/postgresql/pg_durable_http_test_server.log

is_server_running() {
	[ -r "$pid_file" ] || return 1
	server_pid=$(cat "$pid_file")
	[ -r "/proc/$server_pid/cmdline" ] || return 1
	tr '\000' ' ' <"/proc/$server_pid/cmdline" | grep -F "$server_path" >/dev/null
}

start_server() {
	cp "$0" "$server_path.new"
	chmod 700 "$server_path.new"
	mv -f "$server_path.new" "$server_path"

	if is_server_running; then
		return
	fi

	/bin/nc -lk -s 127.0.0.1 -p 18080 -e "$server_path" \
		</dev/null >"$log_file" 2>&1 &
	echo "$!" >"$pid_file"
	sleep 0.1

	if ! is_server_running; then
		cat "$log_file" >&2
		exit 1
	fi
}

respond() {
	IFS= read -r request_line || exit 0
	request_target=${request_line#* }
	request_target=${request_target%% *}

	case "$request_target" in
	/redirect*)
		printf 'HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:18080/followed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'
		;;
	*)
		printf 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok'
		;;
	esac
}

case "${1:-respond}" in
start)
	start_server
	;;
respond)
	respond
	;;
*)
	echo "usage: $0 [start]" >&2
	exit 2
	;;
esac
