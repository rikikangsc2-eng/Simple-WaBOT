FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p session && \
    chown -R node:node /app

USER node

EXPOSE 7860

CMD ["node", "index.js"]