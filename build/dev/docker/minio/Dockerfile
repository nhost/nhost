FROM minio/mc:latest as mc

FROM minio/minio:latest

COPY --from=mc /usr/bin/mc /usr/bin/mc

ADD init.sh /usr/bin/init.sh

ENTRYPOINT ["/usr/bin/init.sh"]
