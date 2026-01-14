# Simple production image for the live ticker
FROM node:20-alpine

WORKDIR /app

# 1) Install deps (cached layer)
COPY package.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm install

# 2) Copy source + build
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
