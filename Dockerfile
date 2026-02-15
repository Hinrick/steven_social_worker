FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN npx tsc

CMD ["node", "dist/index.js"]
