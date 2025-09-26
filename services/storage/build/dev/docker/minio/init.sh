#!/bin/sh

/usr/bin/docker-entrypoint.sh "$@" &

sleep 3

mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc mb myminio/default

dd if=/dev/random of=/tmp/asd bs=64k count=1
mc cp /tmp/asd myminio/default/f215cf48-7458-4596-9aa5-2159fc6a3caf/default/asd
mc cp /tmp/asd myminio/default/this-shouldnt-show-in-list/asd

sleep infinity
