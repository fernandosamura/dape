FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git openssh-client netcat-openbsd tzdata ffmpeg

ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY backend/package*.json ./
RUN npm install

COPY backend/ .

RUN git config --global url."https://".insteadOf ssh://
RUN npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg

COPY certificates ./certs-temp
COPY backend/copy_cert_assets.sh ./
RUN chmod +x copy_cert_assets.sh && ./copy_cert_assets.sh
RUN rm -rf ./certs-temp

ARG STACK_NAME
ENV STACK_NAME=$STACK_NAME

RUN npm run build

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
