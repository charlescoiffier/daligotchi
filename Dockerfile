# Image unique : serveur Fastify + jeu compilé.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages packages
RUN pnpm build

FROM node:24-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile --prod --filter @daligotchi/server
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/drizzle packages/server/drizzle
COPY --from=build /app/packages/client/dist packages/client/dist
WORKDIR /app/packages/server
ENV HOST=0.0.0.0 \
    SERVER_PORT=3000 \
    CLIENT_DIST=/app/packages/client/dist \
    MIGRATIONS_DIR=/app/packages/server/drizzle
USER node
EXPOSE 3000
# Applique les migrations puis démarre le serveur.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
