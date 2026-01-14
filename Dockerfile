# syntax=docker/dockerfile:1.6

# Build the client + server
FROM node:20-slim AS build

WORKDIR /app

# Make npm less "silent" in Docker and avoid extra network calls
ENV CI=true \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false \
    npm_config_loglevel=info

# Install deps per workspace (avoids relying on npm workspaces in Docker layers)
COPY client/package.json ./client/package.json
WORKDIR /app/client
RUN --mount=type=cache,target=/root/.npm npm install

WORKDIR /app
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN --mount=type=cache,target=/root/.npm npm install

# Copy sources + build
WORKDIR /app
COPY . .
RUN cd client && npm run build
RUN cd server && npm run build

# Runtime image: only server prod deps + built assets
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false \
    npm_config_loglevel=info

# Install only server production dependencies
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

# Copy built artifacts
WORKDIR /app
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/dist/client ./dist/client
COPY ticker.config.json ./ticker.config.json

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
