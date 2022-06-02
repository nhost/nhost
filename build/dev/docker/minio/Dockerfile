FROM minio/mc:latest as mc

FROM minio/minio:RELEASE.2022-05-26T05-48-41Z.hotfix.15f13935a

COPY --from=mc /usr/bin/mc /usr/bin/mc

ADD init.sh /usr/bin/init.sh

ENTRYPOINT ["/usr/bin/init.sh"]
