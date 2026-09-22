# Roteiro do bucket R2

Como provisionar o armazenamento de arquivos do Órbita Edu no Cloudflare R2.
O desenho e o porquê de cada regra estão em
[`docs/storage/SPEC-STORAGE-R2.md`](../storage/SPEC-STORAGE-R2.md); aqui é só o
passo a passo.

## 1. Os dois buckets

Em **R2 → Overview → Create bucket**, crie dois:

| Bucket | Para quê |
| --- | --- |
| `orbitaedu-prod` | Produção |
| `orbitaedu-test` | Suíte de integração |

A localização pode ficar no automático — não há dado ainda para escolher melhor.

## 2. A configuração de cada um

Quatro itens, e cada um corresponde a uma regra do produto. **Nenhum é
opcional.**

| Onde | O que fazer | Por quê |
| --- | --- | --- |
| Settings → Public access | **Desligado.** Sem domínio `r2.dev`, sem domínio customizado | §24.2: anexo não é acessível por endereço direto sem verificação de permissão. O único que fala com o bucket é o servidor |
| Settings → Object versioning | **Desligado** | "Revogar apaga" (`photo/service.ts`). Versão anterior retida é cópia que sobrou, e revogação que deixa cópia não é revogação |
| Settings → Object lock / retention | **Nenhuma regra** | Mesmo motivo |
| Settings → CORS | **Vazio** | O navegador nunca fala com o bucket; CORS configurado seria sinal de que alguém abriu um caminho direto |

> **A armadilha mais cara:** ligar versionamento "por segurança" no painel.
> Some da tela, fica no bucket, e a escola passa a guardar a foto de uma criança
> cuja família pediu para apagar. Se quiser cópia de segurança, é cópia para
> outro bucket com a mesma regra de revogação — ver §13 da spec.

### Só no `orbitaedu-test`

Em **Settings → Object lifecycle rules**, crie uma regra apagando objetos com
mais de **1 dia**. A suíte limpa o que cria; a regra é a rede embaixo, para o
dia em que um teste morrer no meio.

## 3. O token S3

Em **R2 → Manage API tokens → Create API token**:

- **Permissions:** `Object Read & Write`
- **Specify bucket(s):** só `orbitaedu-prod` para o token de produção, só
  `orbitaedu-test` para o de teste. **Dois tokens, não um** — o de produção não
  pode alcançar o bucket que a suíte apaga inteiro a cada execução.
- **TTL:** o que a política da conta permitir.

A tela de confirmação mostra, e só uma vez:

- **Access Key ID** → `R2_ACCESS_KEY_ID`
- **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
- **Endpoint** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` → o `<ACCOUNT_ID>`
  é o `R2_ACCOUNT_ID`

## 4. As variáveis

No Coolify, em **app → Configuration → Environment Variables**:

```
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<id da conta>
R2_ACCESS_KEY_ID=<do token de produção>
R2_SECRET_ACCESS_KEY=<do token de produção>
R2_BUCKET=orbitaedu-prod
```

`MEDIA_ENCRYPTION_KEY` precisa estar configurada junto: é ela que cifra foto,
laudo e documento antes de irem ao bucket. Sem ela o app sobe, e gravar arquivo
sensível é recusado com instrução — nunca grava em claro.

> **Não deixe `STORAGE_DRIVER` sem valor em produção.** O padrão é `memory`, e
> em produção `createStorage` recusa subir o storage com ele: seria perda de
> dado silenciosa — o arquivo é aceito, a tela diz que deu certo, e some no
> próximo deploy.

## 5. Os segredos do CI

Em **GitHub → Settings → Secrets and variables → Actions**, para o passo que
roda a suíte de integração na `main`:

| Secret | Valor |
| --- | --- |
| `R2_ACCOUNT_ID` | o mesmo id da conta |
| `R2_ACCESS_KEY_ID` | do token **de teste** |
| `R2_SECRET_ACCESS_KEY` | do token **de teste** |
| `R2_TEST_BUCKET` | `orbitaedu-test` |

Sem eles a suíte de R2 é pulada, com aviso no log, e o contrato roda contra o
adaptador em memória. **Pull request não recebe segredo** — o de fork nunca — e
é por isso que o contrato precisa ser verde em memória sozinho.

## 6. Conferir que ficou certo

```bash
# Roda a suíte de contrato contra o bucket de teste.
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
R2_TEST_BUCKET=orbitaedu-test \
pnpm --filter @educa-escola/api exec vitest run src/storage/r2.test.ts
```

Se a saída disser "pulados — falta ...", alguma variável não chegou. Se passar,
o adaptador grava, lê, lista, pagina e apaga contra o R2 de verdade.

Um último teste, manual, que nenhuma suíte cobre: pegue a URL pública que o
painel mostraria se o acesso público estivesse ligado e confirme que **não há
uma**. Bucket público é a única dessas regras que falha em silêncio.
