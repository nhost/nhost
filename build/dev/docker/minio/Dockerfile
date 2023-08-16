FROM minio/mc:RELEASE.2023-08-08T17-23-59Z as mc

FROM minio/minio:RELEASE.2023-08-09T23-30-22Z

COPY --from=mc /usr/bin/mc /usr/bin/mc

ADD init.sh /usr/bin/init.sh

ENTRYPOINT ["/usr/bin/init.sh"]
