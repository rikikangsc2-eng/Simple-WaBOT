FROM node:20-alpine

RUN apk add --no-cache ca-certificates ffmpeg

WORKDIR /app

RUN mkdir -p /app/session && chmod 777 /app/session

COPY package.json .
RUN npm install --omit=dev --prefer-offline

COPY . .

ARG PORT=7860
EXPOSE ${PORT}

RUN npm install pm2@5.3.0 -g

ENV PM2_PUBLIC_KEY=lkltkk7omprw8ri
ENV PM2_SECRET_KEY=t467p910r7kyg3q
ENV NODE_ENV=production

RUN pm2 install pm2-logrotate && \
pm2 set pm2-logrotate:max_size 10M && \
pm2 set pm2-logrotate:retain 7

CMD ["pm2-runtime", "index.js", "--name", "bot wa", "--no-daemon", "--log", "/dev/null", "--max-memory-restart", "500M"]