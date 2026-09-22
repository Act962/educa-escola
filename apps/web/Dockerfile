FROM node:24-slim AS builder
RUN npm install -g pnpm@11
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1
# the build evaluates the auth config; the real secret comes from compose at runtime
ENV BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime

COPY . .
RUN --mount=type=cache,target=/pnpm-store pnpm install --store-dir /pnpm-store

ENV NODE_ENV=production
RUN cd apps/web && pnpm run build
ENV SKIP_ENV_VALIDATION=
ENV BETTER_AUTH_SECRET=

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# Pelo próprio node, e não por curl: a imagem slim não tem curl nem wget, e o
# healthcheck HTTP do painel do Coolify roda *dentro* do container — sem um
# deles ele falha sempre e o deploy nunca termina. `start-period` cobre as
# migrations, que rodam antes do servidor subir.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web

# Migra antes de servir, no container novo. O pre-deployment do Coolify não
# serve: roda no container antigo, com as migrations da versão anterior, e é
# pulado no primeiro deploy. Se a migração falhar, o servidor não sobe, o
# healthcheck não passa, e o Coolify mantém o container anterior no ar.
# `exec` faz do node o PID 1, para receber o SIGTERM do orquestrador.
CMD ["sh", "-c", "/app/packages/db/node_modules/.bin/jiti /app/packages/db/src/migrate-cli.ts && exec node .output/server/index.mjs"]
