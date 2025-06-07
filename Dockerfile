FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p session && chmod 777 session

EXPOSE 7860

CMD ["node", "index.js"]