# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A língua de trabalho deste projeto é o português. Comentários de código,
> mensagens voltadas ao usuário e documentação seguem em português.

## O produto

Software de gestão escolar com três perfis: **Administrativo**, **Professor** e
**Estudante**. Está em fase de fundação — a base arquitetural já foi decidida
(ver "Decisões estruturais"), o domínio ainda está sendo construído.

## Comandos

Gerenciador de pacotes: **pnpm** 11. Orquestrador: **Turborepo**.

```bash
pnpm install
pnpm run db:start      # Postgres 18 em Docker
pnpm run db:migrate    # aplica as migrations versionadas
pnpm run dev           # web em http://localhost:3001
```

| Comando | O que faz |
| --- | --- |
| `pnpm run test` | Suíte completa (precisa do Postgres no ar) |
| `pnpm run test:watch` | Modo watch |
| `pnpm run check-types` | `tsc --noEmit` em todos os workspaces |
| `pnpm run check` | Biome: formata e corrige lint |
| `pnpm run build` | Build de todos os workspaces |
| `pnpm run db:generate` | Gera migration a partir do schema |
| `pnpm run db:studio` | Drizzle Studio |
| `pnpm run db:stop` / `db:down` | Para / remove o container do Postgres |
| `pnpm run docker:up` / `docker:logs` / `docker:down` | Stack web + Postgres |

Rodar um teste isolado — direto no pacote é o ciclo mais curto:

```bash
cd packages/api && pnpm exec vitest run src/modules/classroom/service.test.ts
```

Pelo Turbo, com filtro de workspace:

```bash
pnpm exec turbo run test -F @educa-escola/api
```

## Decisões estruturais

Quatro decisões sustentam o resto. Mudar qualquer uma é mudança estrutural, não
refactor local.

1. **Multi-tenant em banco único.** Uma instalação serve N escolas. Toda tabela
   de domínio carrega `schoolId`.
2. **Modelo híbrido de identidade.** O Better Auth é dono de identidade, sessão,
   vínculo e papel. O domínio é dono das entidades escolares ricas.
3. **Módulos por domínio com service.** `router` valida e delega, `service` tem a
   regra, `repository` isola o Drizzle.
4. **Vitest com Postgres real.** Regra de negócio testada com dublê em memória;
   repositório testado contra banco de verdade, em transação revertida.

## Arquitetura

### Um único deployable

`bts.jsonc` traz `backend: "self"`: `apps/web` é o único app e serve a UI **e** a
API. Não existe app de servidor separado — endpoint novo é rota nova em
`apps/web/src/routes/`, não um serviço à parte.

Duas superfícies de API montadas como rotas catch-all:

- `apps/web/src/routes/api/trpc/$.ts` → `appRouter`
- `apps/web/src/routes/api/auth/$.ts` → `auth.handler`

### Dependências entre pacotes

```
apps/web  →  packages/api  →  packages/auth  →  packages/db  →  packages/env
             packages/ui (folha)   packages/config (folha, base do tsconfig)
```

Todo `packages/*` **exporta TypeScript cru** — o `exports` aponta direto para
`./src/*.ts`, sem build intermediário.

### Tenant: a escola é a `organization`

A escola é a `organization` do Better Auth — a raiz do tenant. O vínculo
pessoa↔escola e o papel vivem em `member`.

A tabela de domínio `school` **compartilha a chave primária** com `organization`
(1:1). Isso é deliberado: `schoolId === organizationId`, então não existe
mapeamento entre "id da org" e "id da escola" a cada requisição. Atributos
escolares (INEP, timezone) ficam em `school`; tudo que pende da escola aponta
para `school.id`.

### Isolamento entre escolas

Esta é a parte que não pode relaxar. Em banco único, um filtro esquecido vaza
dado de uma escola para outra. Três camadas seguram isso:

1. **`schoolProcedure`** (`packages/api/src/index.ts`) exige sessão *e* escola
   ativa, e injeta `ctx.tenant`. Nenhum resolver descobre sozinho de que escola
   é a requisição.
2. **Repositórios exigem o tenant na construção.** `createClassroomRepository(db, tenant)`
   aplica `eq(table.schoolId, tenant.schoolId)` em toda operação — inclusive
   update e delete, para que um id de outra escola não encontre linha. O
   `schoolId` da criação vem sempre do tenant, nunca da entrada do usuário.
3. **Teste de arquitetura** (`packages/api/src/architecture.test.ts`) falha se
   qualquer arquivo fora de `repository.ts` importar `drizzle-orm` ou
   `@educa-escola/db/schema`. Query fora de repositório provavelmente não filtra
   por escola, então a regra é mecânica, não cultural.

O mesmo teste exige que todo módulo tenha `repository.ts`, `service.ts` e
`router.ts`.

### Anatomia de um módulo

`packages/api/src/modules/classroom/` é a referência a copiar:

| Arquivo | Responsabilidade |
| --- | --- |
| `schema.ts` | Entradas em Zod |
| `repository.ts` | **Único** lugar que monta query. Recebe `(db, tenant)` |
| `service.ts` | Regra de negócio. Recebe o repositório; não conhece HTTP nem Drizzle |
| `router.ts` | Procedures tRPC; amarra permissão, entrada e service |

O service recebe o repositório por parâmetro justamente para ser testável sem
banco e reutilizável fora do tRPC (importação de planilha, job, seed).

### Papéis e permissões

`packages/auth/src/permissions.ts` define os statements e quatro papéis:
`owner`, `admin`, `teacher`, `student`. É importável pelo cliente (não puxa nada
de servidor), então a UI pode esconder o que o papel não permite.

No servidor, use `permitted()` em vez de checar papel à mão:

```ts
create: permitted({ classroom: ["create"] })
  .input(createClassroomInput)
  .mutation(({ ctx, input }) => serviceFor(ctx).create(input)),
```

A checagem é síncrona e sem ida ao banco: o papel já vem resolvido no contexto.
`ctx.getMembership()` é preguiçoso — procedures públicas não pagam a consulta.

Papel desconhecido vira `null` (nega por padrão) em `parseRole`, e o default da
coluna `member.role` é `student`, o menor privilégio.

### Banco

Schema em `packages/db/src/schema/`, reexportado por `schema/index.ts`.
`auth.ts` é **gerado** pelo CLI do Better Auth — ao mexer em plugins, regenere:

```bash
npx auth@latest generate --config packages/auth/src/index.ts --output packages/db/src/schema/auth.ts
```

Depois disso, reaplique à mão o default `student` em `member.role` e gere a
migration.

**Migrations são versionadas.** Não use `db:push` fora de experimento local:
gere com `pnpm run db:generate` e commite. O CI falha se o schema mudar sem
migration correspondente.

### Testes

| Camada | Como testar | Exemplo |
| --- | --- | --- |
| Regra de negócio | Dublê em memória tipado como o repositório real | `modules/classroom/service.test.ts` |
| Repositório | Postgres real, em transação revertida | `modules/classroom/repository.test.ts` |
| Permissões | Matriz de papéis, sem I/O | `packages/auth/src/permissions.test.ts` |
| Arquitetura | Varre o código-fonte | `packages/api/src/architecture.test.ts` |
| Componente | jsdom + Testing Library | `apps/web/src/components/loader.test.tsx` |

Os testes de banco usam um banco **separado** (`<database>_test`), criado e
migrado automaticamente pelo `globalSetup`. `pnpm run test` nunca toca no banco
de desenvolvimento.

Envolva todo teste que escreve com `withRollback` (`@educa-escola/db/testing`):
ele reverte a transação ao final, então nada vaza entre testes.

```ts
await withRollback(async (tx) => {
  const escola = await createTestSchool(tx);
  const repo = createClassroomRepository(tx, { schoolId: escola.id });
  // ...
});
```

Fixtures usam ids aleatórios de propósito — arquivos rodam em paralelo contra o
mesmo banco e nomes fixos colidiriam nos índices únicos.

Dublês de repositório devem ser tipados como a interface real (sem
`as unknown as`): assim quebram na compilação quando o repositório muda, em vez
de mentir.

### Configuração compartilhada

`packages/config/tsconfig.base.json` é a base dos pacotes. `apps/web/tsconfig.json`
é autônomo e define os aliases `@/*` e `@educa-escola/ui/*`.

Versões de dependência ficam centralizadas no `catalog:` do `pnpm-workspace.yaml`.
Ao adicionar ou subir uma dependência compartilhada, edite o catálogo — não fixe
versão por pacote.

## Convenções e armadilhas

- **`apps/web/src/routeTree.gen.ts` é gerado** pelo plugin do TanStack Start,
  ignorado pelo git e excluído do Biome. Nunca edite nem commite. Enquanto ele
  não existe, `tsc` em `apps/web` cospe uma cascata enganosa de erros
  (`Cannot find module './routeTree.gen'` e `createFileRoute` "not assignable to
  parameter of type 'undefined'"). Por isso `web#check-types` depende de `build`
  no `turbo.json`.
- **Um `.env` para o monorepo: `apps/web/.env`** (modelo em `.env.example`).
  `packages/env/src/load.ts` sobe até a raiz do workspace e o carrega por caminho
  absoluto, então qualquer cwd enxerga o mesmo ambiente. Não crie `.env` por
  pacote.
- **Variável de ambiente nova precisa ser declarada em `packages/env`**
  (`src/server.ts` para servidor, `src/web.ts` para `VITE_` no cliente). São
  schemas do `@t3-oss/env-core`: variável não declarada é invisível ao app, e
  declarada porém ausente derruba o boot.
- **`exports` do `packages/db` precisa de entrada explícita para diretórios.**
  O catch-all `"./*"` → `"./src/*.ts"` não resolve `schema`, que é pasta; por
  isso existe `"./schema"` → `"./src/schema/index.ts"`. Vale para qualquer pasta
  nova que você queira exportar.
- **Repositório não devolve query builder.** Os métodos são `async` de propósito:
  sem isso o retorno seria o builder do Drizzle, vazando tipos do ORM para dentro
  do service.
- **Não exponha `Headers` no contexto do tRPC.** Com `declaration: true` o tipo
  vem do `undici-types` e não é nomeável na emissão (TS2883). Se precisar dos
  headers, feche sobre eles numa função, como faz `getMembership`.
- **Primitivos do shadcn têm regras de a11y desligadas** para
  `packages/ui/src/components/`, via `overrides` no `biome.json` — eles são
  regenerados pelo `shadcn add` e supressões inline se perderiam. Código nosso
  continua sujeito a todas as regras; a11y ali é dívida consciente, não isenção
  permanente.
- **Turbo roda em `envMode` strict.** Variável de ambiente que não esteja
  declarada em `tasks.<tarefa>.env` (ou em `globalEnv`) no `turbo.json` **não
  chega** ao processo da tarefa. Isso passa despercebido no local, porque
  `@educa-escola/env` lê o arquivo `apps/web/.env` do disco; no CI não há
  arquivo e a tarefa fica sem env. Ao introduzir uma variável nova, declare-a
  também no `turbo.json`.
- **O preparo do banco de teste é concorrente.** O Turbo dispara as suítes em
  paralelo e todas chamam `ensureTestDatabase`, que por isso usa
  `pg_advisory_lock`. Se for mexer nesse setup, teste apagando o banco de teste
  antes — com ele já criado, a corrida não aparece.
- **`nitro@3.x` é beta** e é o runtime do servidor. Dívida a monitorar.
- **Skills versionadas.** `.claude/skills/` (espelhado em `.agents/skills/`) traz
  skills fixadas de Better Auth, shadcn, Turborepo e boas práticas de React,
  travadas por `skills-lock.json`. Consulte antes de improvisar nessas áreas.
