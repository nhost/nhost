FROM node:24-alpine

WORKDIR /app

COPY shared/ ./shared/
COPY services/my-service/package.json ./services/my-service/package.json
COPY services/my-service/src/ ./services/my-service/src/

USER node

EXPOSE 8000

CMD ["node", "services/my-service/src/index.ts"]
