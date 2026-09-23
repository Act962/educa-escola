FROM node:24-slim AS builder
RUN npm install -g pnpm@11
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1
# the build evaluates the auth config; the real secret comes from compose at runtime
ENV BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime

# Só os manifestos primeiro. Enquanto o lockfile e os package.json não mudam,
# a camada do install é reaproveitada do cache — commit que mexe apenas em
# código-fonte não reinstala nada. Copiar o repositório inteiro antes do install
# (como era) invalidava esta camada a cada alteração de qualquer arquivo.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store

# Agora o código. Muda a cada commit, mas já não invalida o install acima.
# `.dockerignore` mantém node_modules fora, então este COPY não sobrescreve o
# que o install montou.
COPY . .

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
