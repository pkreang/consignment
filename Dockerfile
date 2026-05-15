# syntax=docker/dockerfile:1.7
# ---------- 1. deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json ./
COPY src/prisma/schema.prisma ./src/prisma/schema.prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN npm ci

# ---------- 2. build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema src/prisma/schema.prisma \
 && npm run build \
 && cp -r src/prisma dist/prisma

# ---------- 3. runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -m -u 1001 nodeuser

# Production-only deps + the generated prisma client
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy prisma engines from build stage (generated client)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Compiled JS + Prisma migrations (we serve via compiled dist)
COPY --from=build /app/dist ./dist
# Migration SQL files are needed by `prisma migrate deploy`
COPY --from=build /app/src/prisma ./prisma
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nodeuser
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
