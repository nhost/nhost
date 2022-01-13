#!/bin/sh

/usr/bin/docker-entrypoint.sh "$@" &

sleep 3

mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc mb myminio/default

dd if=/dev/random of=/tmp/asd bs=64k count=1
mc cp /tmp/asd myminio/default/default/asd

sleep infinity
