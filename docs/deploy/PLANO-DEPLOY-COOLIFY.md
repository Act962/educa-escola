# Plano de deploy — VPS gerenciada com Coolify

> Estado: **rascunho para decisão.** Nada aqui foi executado ainda. Os pontos
> marcados `[DECIDIR]` são escolhas do João; o resto é recomendação com o
> motivo ao lado.

## 1. O que vai para o ar

Um único deployable (`apps/web`, TanStack Start + Nitro `node-server`) que
serve UI **e** API, mais um Postgres 18. Não há worker, fila nem storage de
objeto: a foto do aluno vive no banco (`bytea` cifrado com AES-256-GCM), e os
pesos do reconhecimento facial são estáticos em `public/`, copiados no build.

```
Internet ──HTTPS──▶ Traefik (Coolify) ──▶ web :3001 ──▶ Postgres 18 (rede interna)
                                              │
                                              └──▶ saída: provedor do modelo do Astro, Órbita
```

## 2. Topologia no Coolify (recomendada)

| Recurso Coolify | Tipo | Por quê |
| --- | --- | --- |
| `integra-db` | **Database → PostgreSQL 18** gerenciado pelo Coolify | Backup agendado para S3 vem pronto; sem porta pública |
| `integra-web` | **Application → Docker Image** (imagem do GHCR) | Ver §3: build fora da VPS |
| (futuro) `integra-web-staging` | Mesma imagem, outro banco | Onde roda `seed:demo` — nunca em produção |

**Não usar o `docker-compose.yml` do repositório em produção**: ele publica o
Postgres na porta 5432 do host, com senha padrão `password`, e fixa
`BETTER_AUTH_URL=http://localhost:3001`. Ele continua sendo o ambiente local.

## 3. Onde a imagem é construída — **decidido: GitHub Actions**

| Opção | Prós | Contras |
| --- | --- | --- |
| **A. GitHub Actions → GHCR, Coolify puxa a imagem** (escolhida em 2026-09-22) | Build não disputa CPU/RAM com a produção; imagem testada é a que sobe; rollback = trocar a tag | Um workflow a mais; token de leitura do GHCR no Coolify |
| B. Coolify builda o `apps/web/Dockerfile` a partir do Git | Zero configuração extra | Build do Vite + TensorFlow.js em VPS pequena corre risco de OOM e derruba o app no meio do deploy |

Com A, o fluxo fica: CI verde na `main` → job `publish` (em
`.github/workflows/ci.yml`) constrói a imagem, **sobe ela contra um Postgres
descartável e exige 200 em `/api/health`**, e só então publica
`ghcr.io/act962/integra-web:sha-<commit>` e `:main` → webhook de deploy do
Coolify.

- O Coolify acompanha a etiqueta `:main`. Rollback = apontar para uma
  `:sha-<commit>` anterior.
- O login no GHCR usa o `GITHUB_TOKEN` do próprio Actions: nenhum segredo a
  cadastrar para publicar.
- O deploy só é disparado se existirem os segredos `COOLIFY_WEBHOOK` e
  `COOLIFY_TOKEN` no repositório. Sem eles, o job publica a imagem e avisa.
- Depois da primeira publicação, conferir a visibilidade do pacote em
  *github.com/Act962 → Packages → integra-web*. O repositório é público, então
  a imagem pode ser pública (o Coolify baixa sem credencial). Se ficar
  privada, cadastrar no Coolify um token do GitHub com `read:packages`.

## 4. Ajustes no código antes do primeiro deploy

Em ordem de prioridade. Cada um vira um PR pequeno.

1. ✅ **Rota de saúde `/api/health`** que faz `select 1` no banco (200 / 503).
   O healthcheck antigo batia em `/`, que redireciona para `/login` e passava
   mesmo com o banco fora.
2. ✅ **Migrations na subida do container.** `packages/db/src/migrate.ts`
   aplica o lote pendente numa transação, sob lock advisory, e devolve o erro
   do Postgres inteiro — `drizzle-kit migrate` engolia a mensagem. O `CMD` do
   Dockerfile migra e só então faz `exec` do servidor; migração que falha
   impede o servidor de subir, o healthcheck não passa e o Coolify mantém o
   container anterior.
   **Não usar o pre-deployment do Coolify para isso:** segundo a documentação,
   ele roda *no container antigo* (com as migrations da versão anterior) e é
   pulado no primeiro deploy.
   Consequência a lembrar: durante o rolling update o container antigo atende
   com o schema novo. Migration tem de ser compatível com a versão anterior
   (adicionar antes, remover num deploy seguinte).
3. **Imagem mais enxuta.** O `runner` carrega o store do pnpm, devDependencies
   e o código-fonte de todos os pacotes. Funciona, mas é pesado. Avaliar
   `pnpm deploy --prod` ou copiar só `.output` + dependências de runtime.
   Não bloqueia o primeiro deploy.
4. **Remover `CORS_ORIGIN` do compose** — nenhum código lê essa variável.
5. ✅ **Limite de login por conta, e por IP folgado** (opção C, decidida em
   2026-09-22). O padrão do Better Auth é 3 logins a cada 10 s **por IP** — e
   uma escola inteira sai por um IP só, então uma turma entrando junta no
   laboratório seria bloqueada no quarto aluno. Agora:
   - por IP: 60 logins por minuto (`rateLimit.customRules`), só contra
     varredura de muitas contas;
   - por conta: 5 senhas erradas em 15 min bloqueiam aquele e-mail por
     15 min, a partir da sexta tentativa (`packages/auth/src/login-throttle.ts`,
     tabela `login_throttle`). E-mail sem cadastro bloqueia igual, para não
     denunciar quem tem conta.
   **A conferir no primeiro deploy:** o Better Auth já lê `x-forwarded-for`,
   mas só aceita o cabeçalho com **um** IP. Com proxy extra na frente (ex.:
   Cloudflare) vem uma cadeia, o IP fica indeterminado e o limite por IP vira
   um balde único para todos. O sintoma é o aviso "Rate limiting could not
   determine a client IP" no log — se aparecer, configurar
   `advanced.ipAddress.trustedProxies`.
6. ✅ **Workflow de publicação da imagem** no GitHub Actions (opção 3A) — ver §3.

## 5. Variáveis de ambiente de produção

Declaradas em `packages/env/src/server.ts`. No Coolify, todas como *runtime*;
nenhuma precisa estar disponível no build (o Dockerfile usa
`SKIP_ENV_VALIDATION` e um segredo de placeholder).

| Variável | Valor | Observação |
| --- | --- | --- |
| `DATABASE_URL` | URL **interna** do `integra-db` | Nunca pelo IP público |
| `BETTER_AUTH_URL` | `https://<domínio>` | Também vira o único `trustedOrigins` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Trocar derruba todas as sessões |
| `MEDIA_ENCRYPTION_KEY` | `openssl rand -base64 32` | **Perder = perder todas as fotos** |
| `ASSISTANT_ENCRYPTION_KEY` | `openssl rand -base64 32` | Perder = recadastrar a credencial do modelo em cada escola |
| `ORBITA_BASE_URL` | URL do Órbita | Opcional |
| `NODE_ENV` | `production` | Já vem da imagem |

As duas chaves de cifragem **não podem morar só no Coolify**: backup do banco
sem a chave é backup inútil. Guardar cópia num cofre (1Password/Bitwarden da
empresa) antes do primeiro cadastro de foto.

## 6. Domínio e HTTPS

- DNS `A` do domínio para o IP da VPS; o Coolify emite o certificado Let's
  Encrypt pelo Traefik.
- **HTTPS não é opcional aqui:** a portaria usa a câmera (`getUserMedia`),
  que o navegador só libera em contexto seguro. Sem TLS o quiosque cai direto
  na carteirinha.
- `[DECIDIR]` Domínio: `app.integraedu.com.br`? Um por escola
  (`escola-x.integraedu…`) não é necessário — o tenant vem do login.

## 7. Banco e backup

- Postgres 18 gerenciado pelo Coolify, **sem porta pública**. Acesso
  administrativo por túnel SSH quando preciso.
- Backup agendado do Coolify para bucket S3-compatível (Backblaze B2,
  Cloudflare R2 ou Wasabi): diário, retenção de 30 dias.
- **Teste de restauração antes de ter escola real.** Backup que nunca foi
  restaurado é hipótese.
- `[DECIDIR]` Provedor do bucket e se ele fica no Brasil (ver §10).

## 8. Primeiro deploy — roteiro

> Versão detalhada, tela a tela: [PASSO-A-PASSO-COOLIFY.md](PASSO-A-PASSO-COOLIFY.md).

1. Provisionar a VPS (sugestão mínima: 4 vCPU, 8 GB RAM, 80 GB SSD; com
   build fora da VPS, 2 vCPU / 4 GB aguenta o início) e instalar o Coolify.
2. Firewall: só 22 (restrito), 80, 443 e a porta do painel do Coolify
   atrás de IP permitido ou do próprio domínio com TLS.
3. Criar `integra-db`, configurar backup S3 e rodar um backup manual.
4. Gerar os três segredos e guardar no cofre.
5. Criar `integra-web` do tipo *Docker Image* com
   `ghcr.io/act962/integra-web:main`, variáveis, domínio e healthcheck
   `/api/health` na porta 3001 (as migrations rodam sozinhas na subida do
   container).
6. Copiar o *Deploy Webhook* e criar um token de API no Coolify; cadastrar os
   dois como segredos `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN` no GitHub
   (*Settings → Secrets and variables → Actions*).
7. Deploy. Conferir logs e `/api/health`.
8. Provisionar a primeira escola pelo terminal do container no Coolify:
   ```bash
   cd /app/packages/auth && node_modules/.bin/jiti src/provision-cli.ts \
     --name "..." --slug ... --owner-name "..." --owner-email ... --owner-password "..."
   ```
9. Smoke test: login da direção, criar turma, abrir a portaria num tablet
   por HTTPS e confirmar que a câmera abre. Procurar no log o aviso
   "could not determine a client IP" — não pode aparecer (§4.5).
10. Restaurar o backup do passo 3 num banco descartável — prova de que o
    backup presta.

## 9. Operação contínua

| Tema | Proposta |
| --- | --- |
| Deploy | Automático a cada merge na `main` com CI verde |
| Rollback | Redeploy da tag anterior no Coolify. Migrations são só para frente — migration destrutiva exige plano próprio |
| Logs | Os do Coolify no início; `[DECIDIR]` Better Stack / Grafana Loki depois |
| Uptime | Monitor externo em `/api/health` (UptimeRobot / Better Stack) |
| Erros | `[DECIDIR]` Sentry (ou GlitchTip auto-hospedado no próprio Coolify) |
| Placar | `score.apurar` hoje só roda no clique (ver `DECISÃO-JOÃO` em `score/router.ts`). O Coolify tem *Scheduled Tasks*, mas a procedure exige sessão com permissão — precisaria de um CLI `apurar-cli.ts` no molde do `provision-cli.ts`. `[DECIDIR]` se entra agora |
| Atualizações | Coolify e SO com janela semanal; `nitro@3` é beta — fixar versão e ler changelog antes de subir |

## 10. LGPD e dados de menores

O banco guarda dados de crianças e adolescentes, **foto do aluno** e o
material da portaria por rosto (`packages/db/src/schema/gate.ts`) — biometria
é dado pessoal sensível (LGPD, art. 11), e de menor exige o melhor interesse
(art. 14). Isso pesa na escolha de infraestrutura:

- `[DECIDIR]` VPS e bucket de backup **no Brasil** (ex.: região São Paulo)
  simplificam a conversa com a escola e evitam transferência internacional.
- Acesso ao painel do Coolify e ao banco com 2FA e lista curta de pessoas.
- Chamadas ao provedor do modelo do Astro saem do país: verificar o que vai
  no prompt antes de uma escola real usar.

## 11. Decisões pendentes (resumo)

1. ~~Build no GitHub Actions ou na VPS?~~ GitHub Actions — §3
2. Domínio de produção. — §6
3. Provedor e região da VPS e do bucket de backup. — §7, §10
4. Observabilidade: Sentry/GlitchTip e agregador de logs agora ou depois? — §9
5. Agendar a apuração do placar já no primeiro deploy? — §9
6. Staging separado desde o início, ou só produção por ora? — §2

## 12. Riscos conhecidos

- **Migration incompatível com a versão anterior** quebra o container antigo durante o rolling update; ver §4.2.
- **OOM no build** se a imagem for construída na própria VPS.
- **`nitro@3.x` beta** como runtime de produção.
- **Chaves de cifragem sem cópia fora do Coolify** = perda irreversível de
  fotos e credenciais.
- **Stack de PRs aberta** (#1 a #15) ainda não está na `main`, e o #5 pede
  revisão do João antes do merge. O deploy deve sair da `main` depois que a
  pilha entrar, não de uma branch local.
