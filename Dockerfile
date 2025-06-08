FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN apk add --no-cache git && \
npm install --production

COPY . .

USER node

EXPOSE 3000

CMD ["node", "index.js"]