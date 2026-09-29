# Passo a passo — subir o Integra Edu no Coolify

> **A produção já existe** em <https://orbitaedu.nasaex.com>, montada com este
> roteiro em 22/09/2026. Ele continua aqui para remontar o ambiente, criar um
> staging ou refazer o servidor — e as etapas 12 e 13 ainda não foram feitas.
>
> Roteiro de execução do [plano de deploy](PLANO-DEPLOY-COOLIFY.md). Siga na
> ordem: cada etapa depende da anterior. Os nomes de tela seguem a
> documentação do Coolify v4 — se algum rótulo tiver mudado, o conceito é o
> mesmo.

**Pré-requisito no código:** o `Dockerfile` da raiz precisa estar na `main`. O
Coolify clona o repositório e constrói na própria VPS — não há registry nem

imagem publicada.
---

## Etapa 0 — O que ter em mãos antes de começar

| Item | Exemplo | Onde guardar |
| --- | --- | --- |
| VPS com Ubuntu 24.04 LTS, acesso SSH como root | 4 vCPU · 8 GB · 80 GB | — |
| Domínio do app | `orbitaedu.nasaex.com` | — |
| Domínio do painel do Coolify (diferente do app) | `painel.nasaex.com` | — |
| Bucket S3-compatível para backup + chaves de acesso | Backblaze B2, Cloudflare R2 | Cofre |
| Cofre de senhas da equipe | 1Password, Bitwarden | — |

## Etapa 1 — DNS

No provedor do domínio, crie dois registros **A** apontando para o IP da VPS:

```
orbitaedu.nasaex.com  A   <IP da VPS>
painel.nasaex.com     A   <IP da VPS>
```

Faça isso primeiro: o certificado HTTPS só é emitido depois que o DNS
propaga, e isso pode levar de minutos a algumas horas.

## Etapa 2 — Instalar o Coolify na VPS

Por SSH na VPS:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Quando terminar, abra `http://<IP da VPS>:8000` **imediatamente** e crie a
conta de administrador. Quem abrir essa página primeiro vira administrador do
servidor — não deixe para depois.

Na conta criada, ative **2FA** (perfil do usuário).

## Etapa 3 — Painel com HTTPS e firewall

1. **Settings → Configuration → URL:** `https://painel.nasaex.com` →
   **Save**. Confirme que o painel abre por esse endereço com cadeado.
2. Firewall da VPS (no painel do provedor ou `ufw`): libere só **22, 80 e
   443**. As portas **8000, 6001 e 6002** só eram necessárias para o acesso
   por IP; com o painel no domínio, feche-as.
3. Se possível, restrinja a porta **22** ao IP de quem administra.

## Etapa 4 — Projeto

**Projects → + Add** → nome `Integra Edu`. Ele vem com o ambiente
`production`; é dentro dele que ficam o banco e o app.

## Etapa 5 — Banco de dados

1. No ambiente `production`: **+ New → Databases → PostgreSQL**.
2. **Image:** `postgres:18` (a mesma versão do CI e do desenvolvimento).
3. **Name:** `integra-db`. Deixe o Coolify gerar usuário e senha.
4. **Não ative** "Make it publicly available". O app fala com o banco pela
   rede interna.
5. **Start**. Espere o status ficar *Running*.
6. Copie a **Postgres URL (internal)** — é o `DATABASE_URL` da etapa 7.

## Etapa 6 — Backup do banco

1. **Settings (do Coolify) → S3 Storages → + Add**: endpoint, bucket, região,
   access key e secret do bucket. **Validate Connection**.
2. No `integra-db` → **Backups → + Add**:
   - frequência `0 3 * * *` (todo dia às 3h),
   - marque **Save to S3** e escolha o storage,
   - retenção: 7 dias local, 30 dias no S3.
3. **Backup Now** uma vez e confira o arquivo no bucket.

## Etapa 7 — Gerar os segredos

Na sua máquina (ou na VPS), gere **três valores diferentes**:

```bash
openssl rand -base64 32
```

| Variável | Para quê | Se perder |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Assina as sessões | Todo mundo precisa entrar de novo |
| `MEDIA_ENCRYPTION_KEY` | Cifra a foto do aluno | **As fotos ficam ilegíveis para sempre** |
| `ASSISTANT_ENCRYPTION_KEY` | Cifra a credencial do modelo do Astro | Recadastrar a credencial em cada escola |

**Guarde os três no cofre antes de continuar.** Backup do banco sem a chave de
mídia é backup inútil para as fotos.

## Etapa 8 — Aplicação

1. No ambiente `production`: **+ New → Private Repository (with GitHub App)**,
   e escolha o repositório `Act962/educa-escola`.
2. **Branch:** `main` · **Build Pack:** `Dockerfile` · **Base Directory:** `/`
   (a raiz do repositório, não `apps/web`).
3. **Configuration → General:**
   - **Name:** `integra-web`
   - **Domains:** `https://orbitaedu.nasaex.com`
   - **Ports Exposes:** `3001` (o padrão é 80 — **troque**, senão o proxy não
     acha o app)

   **Configuration → Advanced:** deixe **Include Source Commit in Build**
   *desmarcado* (marcado, o hash do commit invalida o cache de dependências a
   todo deploy) e **Disable Build Cache** também desmarcado.

4. **Configuration → Environment Variables** — todas como variável de
   *runtime* (desmarque *Available at Buildtime*: o `Dockerfile` já fixa o que o
   build precisa, e segredo como argumento de build é vazamento à toa):

   ```
   DATABASE_URL=<Postgres URL (internal) da etapa 5>
   BETTER_AUTH_URL=https://orbitaedu.nasaex.com
   BETTER_AUTH_SECRET=<etapa 7>
   MEDIA_ENCRYPTION_KEY=<etapa 7>
   ASSISTANT_ENCRYPTION_KEY=<etapa 7>
   ```

   `ORBITA_BASE_URL` só quando o Órbita estiver no ar. `BETTER_AUTH_URL`
   precisa ser **exatamente** o domínio com `https://` e sem barra no fim: é o
   único endereço de onde o login é aceito.

5. **Configuration → Healthcheck:** ative, **Type: CMD**, com o comando:

   ```
   node -e "fetch('http://127.0.0.1:3001/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
   ```

   *Start period* de **90 s** (as migrations rodam antes do servidor subir).

   **Não use o tipo HTTP.** O check HTTP do painel roda `curl` ou `wget`
   *dentro* do container, e a imagem (`node:24-slim`) não tem nenhum dos dois:
   o container ficaria sempre "unhealthy" e o deploy nunca terminaria. A
   imagem também traz um `HEALTHCHECK` próprio com esse mesmo comando, que
   vale fora do Coolify (Docker Compose, `docker run`).
## Etapa 9 — Primeiro deploy

1. **Deploy**. Acompanhe em **Deployments → (o mais recente) → logs**.
2. Nos logs do container, a sequência esperada é:

   ```
   [migrate] N migration(s) aplicada(s); N no total.   (no primeiro deploy, N = todas)
   ➜ Listening on: http://localhost:3001/ (all interfaces)
   ```

   Se aparecer `[migrate] Falhou.`, o erro do Postgres vem logo abaixo; o
   servidor não sobe até isso ser resolvido. O motivo mais comum no primeiro
   deploy é `DATABASE_URL` errado.
3. Abra `https://orbitaedu.nasaex.com/api/health`. Esperado:

   ```json
   {"status":"ok","checks":{"database":"ok"}}
   ```

## Etapa 10 — Primeira escola

Não existe auto-cadastro: a escola é provisionada por comando. No app →
**Terminal** (abre um shell dentro do container):

```bash
cd /app/packages/auth && node_modules/.bin/jiti src/seed-producao-cli.ts \
  --name "Escola Municipal X" --slug escola-x --dominio escola-x.br \
  --turma "6º A" --segmento fundamental_ii --serie 6
```

Isso deixa a escola pronta para o primeiro dia: a `organization`, a `school`,
**um acesso por papel** (direção `owner`, secretaria `admin`, professor
`teacher`, aluno `student`), as oito disciplinas da base comum e a turma, com o
aluno matriculado nela. Os e-mails saem do `--dominio` (`direcao@escola-x.br`,
`secretaria@…`, `professor@…`, `aluno@…`); para endereços reais, passe
`--email-direcao`, `--email-secretaria`, `--email-professor` e `--email-aluno`,
e os nomes em `--nome-*`.

**As senhas são geradas pelo comando e aparecem uma única vez**, ao final. Copie
da tela do Terminal antes de fechá-la, entregue por canal seguro, e peça a troca
no primeiro acesso. Não há como recuperá-las depois — quem perder usa "esqueci
minha senha".

O comando **nunca apaga**, e é idempotente pelo `--slug`: rodar de novo apenas
acrescenta o que faltava, e conta que já existe tem a senha mantida. Se a escola
foi criada antes com `provision-cli.ts`, rodar este comando acrescenta os três
acessos restantes, as disciplinas e a turma, sem tocar na direção.

Só a escola e a direção, sem o resto, continua sendo
`node_modules/.bin/jiti src/provision-cli.ts` — com `--owner-password` escolhida
por você, em vez de gerada.

Para **apresentar o produto a partir daqui**, com os painéis mostrando números
em vez dos estados vazios, acrescente `--com-demonstracao --sala "Sala 12"`. Ele
põe 31 colegas na turma, seis semanas de aula, chamadas e notas, com uma chamada
em atraso e uma Prova 2 em rascunho faltando duas notas — o roteiro montado.

É **dado fictício em banco de produção**, e por isso é opt-in: use só para a
apresentação, e conte que alguém vai ter de distinguir esses alunos dos
verdadeiros depois. O relatório final imprime o id da turma e como remover.
Turma noturna não é aceita com a flag: a grade de demonstração não tem horário
da noite.

**Nunca rode `seed:demo` aqui.** Ele apaga e regrava a escola de demonstração;
é para um ambiente de staging. O `--com-demonstracao` é o contrário: nunca
apaga, e se a turma já tem aula não escreve.

## Etapa 11 — Smoke test

- [ ] Login da direção em `https://orbitaedu.nasaex.com` funciona.
- [ ] Criar uma turma e um aluno; conferir que aparecem.
- [ ] Abrir `/portaria` num tablet **pelo domínio com HTTPS** e confirmar que
      a câmera liga (sem HTTPS o navegador bloqueia a câmera).
- [ ] Nos logs do app, **não** pode aparecer
      `Rate limiting could not determine a client IP`. Se aparecer, o limite
      de login por IP não está vendo o IP real — ver §4.5 do plano.
- [ ] Errar a senha 6 vezes com um e-mail de teste mostra "Muitas tentativas
      com este e-mail…".

## Etapa 12 — Deploy automático a cada merge na `main`

Não há webhook, token de API nem segredo no GitHub: o Coolify recebe o push
pelo GitHub App da etapa 8 e constrói sozinho.

1. No app `integra-web` → **Configuration → Advanced**, confira
   **Auto Deploy** ligado (é o que reage ao push na `main`).
2. Teste: faça um merge qualquer na `main`. Um deploy novo deve aparecer em
   **Deployments**, com o build nos logs.
3. **O deploy não espera o CI.** Mescle só com o CI verde — o job **Imagem
   migra e responde** é quem prova, antes do merge, que o `Dockerfile` constrói
   e o container atende.

## Etapa 13 — Provar que o backup presta

1. Crie um segundo PostgreSQL 18 descartável (`integra-db-restore-teste`).
2. **Configuration → Import Backup → Restore from S3**, escolha o arquivo do
   backup da etapa 6 e restaure.
3. Conecte pelo **Terminal** do banco e confira que as tabelas e a escola da
   etapa 10 estão lá (`select name from organization;`).
4. Apague o banco descartável.

Backup que nunca foi restaurado é hipótese. Repita a cada trimestre.

---

## Operação do dia a dia

| Situação | O que fazer |
| --- | --- |
| Deploy novo | Automático a cada push na `main`, construído pelo Coolify. Não espera o CI: mescle com ele verde |
| Voltar uma versão | App → **Deployments → Rollback**, na imagem anterior (só existe enquanto a limpeza de Docker da VPS não a apagou). Sem ela, reverta o commit na `main` e deixe o deploy rodar |
| Deploy não terminou | Logs do deploy e do container. `[migrate] Falhou.` = problema de migration; container reiniciando sem esse log = variável de ambiente faltando |
| App fora do ar | `https://orbitaedu.nasaex.com/api/health`: 503 é o banco; sem resposta é o container ou o proxy |
| Nova escola | Etapa 10 |

**Rollback não desfaz migration.** Voltar a imagem para uma versão anterior
não volta o schema do banco. Por isso toda migration precisa continuar
funcionando com a versão anterior do app (adicionar coluna num deploy,
remover a antiga só num deploy seguinte).
