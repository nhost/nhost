FROM hasura/graphql-engine:v2.2.0

RUN apt-get update && apt-get install -y curl

WORKDIR /hasura/

ADD . .

CMD ["/hasura/init.sh"]
