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

# Copy lockfile and all package.json files for workspace install
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

# Install all dependencies using lockfile (deterministic)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy sources + build
COPY . .
RUN npm run build

# Runtime image: only server prod deps + built assets
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false \
    npm_config_loglevel=info

# Copy lockfile and package files for deterministic prod install
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json

# Install only server production dependencies using lockfile
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=server

# Copy built artifacts
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/dist/client ./dist/client
COPY ticker.config.json ./ticker.config.json

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
