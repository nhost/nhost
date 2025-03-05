FROM minio/mc:RELEASE.2025-02-28T09-55-16Z as mc

FROM minio/minio:RELEASE.2025-02-28T09-55-16Z

COPY --from=mc /usr/bin/mc /usr/bin/mc

ADD init.sh /usr/bin/init.sh

ENTRYPOINT ["/usr/bin/init.sh"]
