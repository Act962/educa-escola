# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A língua de trabalho deste projeto é o português. Comentários de código,
> mensagens voltadas ao usuário e documentação seguem em português.

## O produto

**Órbita Edu** — software de gestão escolar multi-instituição, com três vias de
acesso: **Gestão**, **Professor** e **Aluno**. Faz parte do ecossistema Órbita,
de onde vêm os apps da aba Apps.

Duas camadas de nome antigo continuam no lugar, e nenhuma é acidente:

- **`educa-escola`** é o nome do scaffold, e batiza o repositório e os pacotes
  (`@educa-escola/api`…). Renomear pacote em monorepo é mudança mecânica e
  barulhenta que não muda nada para quem usa o produto.
- **`Integra Edu`** foi o nome anterior do produto, e ainda aparece nos
  documentos de requisito (`INTEGRA-EDU-*.md`), nos comentários que descrevem
  a identidade visual e nos nomes de token (`--ie-*`, `packages/ui/src/integra/`).
  **Nenhuma tela mostra mais esse nome** — a troca da marca foi feita; o que
  sobrou é nomenclatura interna, e vale trocar num passo próprio, para o
  histórico não misturar renomeação com mudança de comportamento.

Está em fase de fundação: a base arquitetural existe e está testada (ver
"Decisões estruturais"), o domínio praticamente todo ainda não foi construído.

### Onde está a especificação

| Documento | O que traz |
| --- | --- |
| `INTEGRA-EDU-REQUISITOS.md` | 34 seções: perfis, modelo acadêmico, MVP (§31), backlog (§32), lacunas em aberto (§33) |
| `INTEGRA-EDU-DESIGN-BRIEF.md` | Como pedir e revisar tela; estados obrigatórios; prioridades por dispositivo |
| `INTEGRA-EDU-UI-KIT.md` | Como levar o mockup ao código sem perder fidelidade; inventário de componentes |
| `docs/design/{gestao,professor,aluno}/` | PNGs exportados do canvas — **a referência que o código persegue** |
| `DEMO.md` | Como subir com dados e o que mostrar numa apresentação |
| `docs/deploy/` | Plano de deploy e o roteiro tela a tela do Coolify |
| `docs/storage/SPEC-STORAGE-R2.md` | A camada de arquivos: porta, adaptadores, contrato e as três fases |

Canvas de origem do fluxo do Professor:
<https://claude.ai/code/artifact/06b60c49-cbb7-4c62-8389-f9a3f2611436>
(privado até ser compartilhado; o README de cada pasta aponta o seu).

O requisito marca as próprias pendências: **29 pontos `[A VALIDAR]`** e 15
`[RECOMENDAÇÃO]`. São decisões do usuário — não resolva por conta própria.

### Regra de processo

**Leiaute aprovado antes de escrever código.** Tela nova passa pelo checklist do
`INTEGRA-EDU-DESIGN-BRIEF.md` §9 e por aprovação explícita; só então implementa.

### Distância entre o especificado e o construído

O MVP (§31) tem 24 módulos. Construídos: **turma, aluno, aula com chamada e
diário, avaliação com nota em rascunho/publicada** e os painéis dos três
perfis. É o suficiente para o fluxo diário de professor e aluno fechar de ponta
a ponta; o resto do §31 não existe.

Fora do ar, e sinalizado como "em breve" no próprio menu: matrículas,
financeiro, comunicados, relatórios, calendário, grade horária, atividades e
materiais. O item de menu aparece desabilitado de propósito — esconder o
roadmap faz o produto parecer menor, e link que não leva a lugar nenhum é pior.

Desalinhamentos ainda abertos:

- **Papéis.** O requisito §2.2 prevê administrador, diretor, coordenador,
  secretário, responsável financeiro, professor e funcionário. O RBAC tem
  `owner/admin/teacher/student`. Precisa reconciliar.
- **Multi-instituição.** O requisito trata professor com vínculo em várias
  escolas; `schoolProcedure` assume uma escola ativa por requisição, o que
  serve, mas a `ContextBar` ainda não troca de instituição — hoje a escola
  ativa é definida no login (ver `databaseHooks.session.create` em
  `packages/auth/src/index.ts`) e trocar exige sair e entrar.
- **Turma rasa.** `classroom` é nome + ano letivo. O requisito amarra turma a
  série, disciplinas, grade horária e professores alocados. A matrícula
  valida o que dá — só o ano letivo da turma; série, unidade e vaga (RN-041 e
  RN-042) ficam sem validação até a turma ser aprofundada.
- **Matrícula projeta sobre o aluno.** `enrollment` é dono do vínculo datado e
  do histórico por ano; `student.classroomId` e `student.status` continuam
  sendo o que a chamada e a grade de notas leem, escritos na confirmação e no
  cancelamento dentro de uma transação. A migração futura é `listByClassroom`
  passar a ler `enrollment`, com backfill, quando todo aluno tiver matrícula
  do ano corrente. Até lá, `student.status` tem duas origens — matrícula e
  edição direta da secretaria — e tela que edite status livremente faz as duas
  divergirem.

## Comandos

Gerenciador de pacotes: **pnpm** 11. Orquestrador: **Turborepo**.

```bash
pnpm install
pnpm run db:start      # Postgres 18 em Docker
pnpm run db:migrate    # aplica as migrations versionadas
pnpm run dev           # web em http://localhost:3001
```

**Sem provisionar uma escola não dá para entrar no app.** Escolas não são
criadas por auto-cadastro (`allowUserToCreateOrganization: false`): quem
provisiona é a plataforma, por script. É o passo que falta entre `db:migrate` e
conseguir logar:

```bash
pnpm --filter @educa-escola/auth run provision -- \
  --name "Escola Municipal X" --slug escola-x \
  --owner-name "Maria Diretora" \
  --owner-email diretoria@escola-x.br --owner-password "uma-senha-forte"
```

Cria a `organization`, a `school` e o primeiro `member` como `owner`. É
idempotente pelo `slug`. Roda via `jiti` porque o CLI importa TypeScript com
resolução de bundler, que o Node puro não resolve.

**Para escola nova em produção, o comando é o `seed:producao`** — é o
`provision` levado até o fim, com um acesso de cada tipo:

```bash
pnpm run seed:producao -- \
  --name "Escola Municipal X" --slug escola-x --dominio escola-x.br
```

Cria a escola, **quatro contas — uma por papel do RBAC** (`owner`, `admin`,
`teacher`, `student`) —, as oito disciplinas da base comum e uma turma com o
aluno matriculado nela. São quatro e não três porque a via de Gestão tem dois
papéis com poderes diferentes: só a direção exclui a escola e instala app do
Órbita.

Três coisas que separam este seed do `seed:demo`, e nenhuma é detalhe:

- **Nunca apaga.** O `seed:demo` começa deletando para a demonstração ser
  sempre igual; aqui isso destruiria a escola. Toda etapa procura antes de
  escrever, então rodar de novo — ou rodar depois de um `provision` — só
  acrescenta o que faltava, e o relatório diz o que criou e o que reaproveitou.
- **Senha gerada, mostrada uma vez.** Sem senha no código e sem senha
  compartilhada: 16 caracteres de um alfabeto sem `O`/`0` e `I`/`l`/`1`, porque
  a senha do primeiro acesso é lida numa tela, digitada em outra e às vezes
  ditada por telefone. Conta que já existia tem a senha **mantida** — comando de
  preparação não derruba acesso de quem já usa o sistema.
- **Nada de fictício, exceto o que o app exige.** Nenhuma aula, nota ou
  chamada; os painéis abrem nos estados vazios. A ficha do aluno existe porque
  sem `student` casado com o `userId` a via do Aluno responde "nenhuma matrícula
  vinculada a este acesso" e não abre — e vem com matrícula `ativa` e trilha,
  não só a projeção em `student`.

`seed-producao-data.ts` guarda o que é decidido antes de escrever (perfis,
disciplinas, geração de senha, sequência de matrícula) e é testado sem banco em
`seed-producao-data.test.ts`.

**Para apontar para outro banco, `--env-file`** — um Postgres local à parte, uma
cópia de homologação:

```bash
pnpm run seed:producao -- --env-file apps/web/.env.local \
  --name "Escola de Testes" --slug escola-teste --dominio escola-teste.br
```

O arquivo pedido ganha do que já estiver no ambiente, e é por isso que o CLI
importa o seed por `import()` no fim do arquivo: `@educa-escola/env` valida o
ambiente no carregamento do módulo, então um `import` estático abriria conexão
com o banco do `apps/web/.env` antes de a flag ser lida. Apontar para o banco
errado é o erro que este comando mais precisa tornar impossível.

Para desenvolver ou demonstrar, o atalho é a escola de exemplo — turmas,
alunos, aulas, chamadas, avaliações e notas coerentes entre si:

```bash
pnpm run seed:demo
```

**As aulas são geradas em torno da data de execução**, não em datas fixas:
"Aulas de hoje" precisa ter conteúdo no dia em que alguém abre o app. Rodar de
novo apaga e regrava, então o estado é sempre o mesmo. Acessos e roteiro em
`DEMO.md`.

Os dados e os geradores vivem em `seed-demo-data.ts`, separados da escrita em
`seed-demo.ts`: lá não há banco, é tudo função pura, e `seed-demo-data.test.ts`
cobre a grade horária, a alocação de professores e a distribuição de notas sem
subir Postgres. Três armadilhas que esse teste guarda:

- **Nada sorteia.** Demonstração que muda de número a cada execução não se
  ensaia. Todo valor vem de aritmética sobre o índice — e o passo precisa ser
  coprimo com o tamanho da lista, senão degenera: com passo 30 numa lista de 30
  sobrenomes a turma inteira virou homônima.
- **Frequência é guardada como taxa, não como número de faltas.** A grade
  cresceu de 5 para 20 aulas semanais e a Júlia teria saltado de 67% para 92%,
  deixando de ser o exemplo de aluno abaixo do mínimo.
- **O professor da demonstração é fixado nas turmas do roteiro**
  (`TURMAS_DO_PROFESSOR_DEMO`). Depender do desempate da alocação já tirou o
  Ricardo do 9º B quando o critério mudou.

| Comando | O que faz |
| --- | --- |
| `pnpm run test` | Suíte completa (precisa do Postgres no ar) |
| `pnpm run test:watch` | Modo watch |
| `pnpm run check-types` | `tsc --noEmit` em todos os workspaces |
| `pnpm run check` | Biome: formata e corrige lint |
| `pnpm run build` | Build de todos os workspaces |
| `pnpm run seed:demo` | Popula a escola de demonstração (regrava se já existir) |
| `pnpm run seed:producao -- --name … --slug … --dominio …` | Escola nova com um acesso por papel. Nunca apaga |
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

### Módulos existentes

| Módulo | O que resolve |
| --- | --- |
| `classroom` | Turma. O módulo mais simples — use como referência de forma |
| `enrollment` | Matrícula: ciclo de vida, responsável, convite, consentimento e trilha |
| `enrollment-link` | O fluxo do responsável pelo link público, sem sessão |
| `photo` | Foto do aluno para a catraca: consentimento, cifragem e revogação |
| `student` | Aluno, matrícula, frequência derivada e o recorte "em risco" |
| `lesson` | Aula, chamada, diário e prazo de registro |
| `assessment` | Avaliação, grade de notas, média ponderada e publicação |
| `overview` | Números dos três painéis. Só consulta agregada, nunca lista |
| `gate` | Portaria: quem passou no portão, quando e por qual meio. **Não é chamada** |

A fila de pendências da direção é **uma lista só**: quem deve chamada e quem
deve apenas nota saem juntos de `overview.gestao`, ordenados pelo tamanho da
dívida. Eram duas, e a tela mostrava a primeira e esquecia a segunda — com um
professor no banco isso não aparecia; com vinte, sumiam seis.

Três regras de negócio atravessam quase tudo e vivem num lugar só:

- **Frequência mínima de 75%** (LDB, art. 24, VI) —
  `student/service.ts`. Atraso conta como presença. Sem aula registrada a
  frequência é `null`, não 0%: senão a tela acusaria de faltoso quem ainda não
  teve aula.
- **Média ponderada e situação** — `assessment/service.ts`. Avaliação sem
  lançamento **não vale zero**: fica de fora da conta, e a situação do aluno
  fica em "sem nota" enquanto houver pendência. Veredito sobre nota parcial é
  afirmação que os dados não sustentam.
- **Publicação é o que torna a nota visível ao aluno** — e não acontece com
  aluno sem lançamento. O boletim do aluno lê só `status = 'publicada'`, e o
  filtro é na query, não numa checagem depois.
- **Quem está na sala é `ENROLLED_STATUSES`** (`student/schema.ts`): `ativo` e
  `documentacao_pendente`. Documentação pendente não tira o aluno da turma — ele
  assiste à aula, recebe nota e conta como pendência. A constante existe porque
  a grade de notas listava os dois e a checagem de publicação contava só
  `ativo`: o aluno aparecia como "Sem nota" na tela e a publicação passava
  assim mesmo, deixando no boletim exatamente o buraco que a regra proíbe.

**O link de confirmação é a única exceção ao RBAC.** O responsável não tem
conta — o requisito só lhe dá portal pós-MVP —, então a autorização dele é a
posse de um token de 256 bits mais a conferência da data de nascimento do
aluno. Três coisas seguram isso:

1. **Só o hash do token vai ao banco.** Dump de banco não produz link que
   funcione. `enrollment_invite` guarda uso único (`consumedAt`), revogação
   (`revokedAt`), prazo e um contador de tentativas que mata o convite na
   quinta.
2. **`createInviteLookup` é a única consulta do sistema sem filtro de escola.**
   Não há sessão de onde tirar o tenant; o `schoolId` da linha encontrada é o
   que vira o `TenantContext` de todo o resto. O comentário está no ponto exato
   em que a exceção existe, porque `architecture.test.ts` não a pega — o
   factory com tenant no mesmo arquivo satisfaz a regra mecânica.
3. **Nenhum endpoint anônimo escreve em `student`.** `aceitar` grava a ficha
   como evento, registra consentimento e consome o convite; a matrícula segue
   pendente até a gestão confirmar com `enrollment: ["update"]`.

Token desconhecido responde 404 uniforme, para não deixar enumerar. Token
conhecido porém vencido, consumido ou revogado responde `EXPIRED` — quem chega
ali já possui aquele token, e precisa ler "peça um novo" em vez de "não
encontrado".

**O número de matrícula é sequencial e estável; o agrupamento é derivado.**
`2026-0042` continua por escola e por ano, e a busca do último casa só o
formato canônico (`LIKE '2026-____'`) — número herdado de outro sistema não
empurra a sequência. O código de turma `6M` (série + turno) vive em
`modules/enrollment/codes.ts` e é **calculado, nunca guardado**: dentro do
número de matrícula ou numa coluna, ele passaria a mentir no dia em que o
aluno avançasse de série. É a chave de leitura do disparo em massa — mas quem
filtra de fato consulta `classroomId` e `shift`, que a `list` já aceita.

A série sai do texto do nome da turma, porque `classroom` não a guarda como
campo. Turma sem número no nome devolve código nulo em vez de inventar. Some
quando a turma ganhar série de verdade.

**A foto do aluno é cifrada na aplicação, não só no provedor.** A ameaça
realista não é invadirem o datacenter da Neon — é a `DATABASE_URL` vazar, e ela
vive num arquivo `.env`. Por isso a foto vai como AES-256-GCM em
`packages/api/src/media/crypto.ts`, com a chave em `MEDIA_ENCRYPTION_KEY`, fora
do banco: um dump sem a chave devolve ruído. GCM e não CBC porque a etiqueta
detecta adulteração — trocar a foto de uma criança pela de outra seria
silencioso num modo sem autenticação.

Três regras a não relaxar: **sem consentimento de `biometria` não grava** (é
uma finalidade própria — autorizar foto no mural não é autorizar
reconhecimento facial na entrada); **cada leitura vira evento `foto_aberta`**
(§13.3 pede registro de leitura em documento sensível); e **revogar apaga**,
mantendo só o registro de que houve consentimento e de que ele foi revogado.

**O sentido da passagem é do portão, nunca de um botão.** `/portaria?sentido=entrada`
e `?sentido=saida` são dois quiosques — uma câmera em cada portão, que é o
desenho certo. Sem o parâmetro, o serviço alterna a partir da última passagem
do dia. A alternância tem um defeito que a câmera dupla resolve e ela não:
releitura na fila viraria "saiu da escola". Por isso **duas leituras do mesmo
aluno em menos de um minuto são a mesma passagem**, independentemente do
sentido — ninguém entra na escola e sai dela em cinquenta segundos.

**A portaria é um fato à parte da chamada.** `school_entry` guarda a passagem
no portão — aluno, horário, direção e método (`rosto`, `carteirinha`,
`manual`). O professor vê "entrou às 7h12" ao lado do nome e continua sendo
quem marca presença: entrar na escola não é estar na aula, e matar aula é
justamente entrar e não subir. Preenchimento automático faria a catraca mentir
sobre frequência, que é o dado que decide reprovação por falta.

**O molde facial passou a morar aqui — por decisão do usuário, não por
arquitetura.** `student_face_template` guarda o descritor do rosto, cifrado com
a mesma chave da foto. Descritor **não** é anonimização: pela LGPD continua
sendo dado biométrico, e o texto do termo de consentimento ainda não cobre esta
finalidade — isso é pendência jurídica registrada, não detalhe de código. Três
regras seguram o resto: sem consentimento de `biometria` não grava; revogar a
foto apaga o molde no mesmo gesto (`apagarMoldeFacial` é dependência
obrigatória do service da foto, para o compilador cobrar quem esquecer); e a
carteirinha com QR é o caminho que **nunca falha** — todo erro do rosto termina
pedindo o QR, nunca barrando criança na porta.

A comparação vive em `modules/gate/recognition.ts`, sem banco nem tela,
porque é a única parte do sistema que pode identificar uma criança como outra.
Além do limiar há uma **margem mínima**: dois alunos quase à mesma distância
devolvem "ambíguo", não o menor por centésimos — irmãos parecidos existem, e
liberar a criança errada não se desfaz.

**Qual biblioteca extrai o descritor é `DECISÃO-JOÃO`**
(`apps/web/src/lib/face-extractor.ts`). Até ela existir, a portaria sobe e
atende inteira pela carteirinha.

**O molde facial do fornecedor não mora aqui.** Ele é proprietário do algoritmo que o gerou e
não é portátil entre fornecedores, então guardá-lo seria custodiar biometria de
menor sem ganhar nada. A foto é o que permite recadastrar em outra catraca sem
trazer criança de volta. Quem não autoriza a face entra pela carteirinha com o
QR do número de matrícula — recusar não pode barrar criança na porta da escola,
e é isso que faz o consentimento ser opcional de verdade.

**A entrega do link é manual por enquanto.** `packages/api/src/messaging/messenger.ts`
é a costura: hoje `createManualMessenger` registra e não envia, e o endereço
aparece uma única vez, na criação, com botão de copiar. Quando o WhatsApp
oficial entrar, é outra implementação atrás da mesma interface — e aí o
endereço deixa de precisar aparecer.

`overview` importa esses limiares dos outros services em vez de repeti-los; do
contrário o painel e o boletim discordariam sobre quem está aprovado.

### Armazenamento de arquivos

`packages/api/src/storage/` é uma porta com adaptadores, como `messaging/`:
`ObjectStorage` (`port.ts`) tem seis métodos — `put`, `get`, `head`, `delete`,
`list`, `deletePrefix` — e **nenhum devolve endereço, todos devolvem bytes**.
`r2.ts` é o Cloudflare R2 pela API do S3 e o **único arquivo que conhece o
`@aws-sdk`**; `memory.ts` é o dublê que roda em todo PR. Os dois passam pela
mesma suíte (`contract.ts`), porque "passa em memória" precisa significar "passa
no R2". Detalhes e decisões em `docs/storage/SPEC-STORAGE-R2.md`; o roteiro do
bucket em `docs/deploy/BUCKET-R2.md`.

Quatro coisas que não são óbvias:

- **Não existe URL pré-assinada, e é decisão.** A §24.2 diz que anexo não é
  acessível por endereço direto sem verificação de permissão, e a §13.3 pede
  registro de *cada* leitura — link assinado falha nas duas. Para o que é
  cifrado pela aplicação ele nem funcionaria: entregaria texto cifrado a um
  navegador sem a chave. A leitura passa pelo servidor.
- **`createTenantStorage` é o `eq(table.schoolId, …)` do bucket.** Toda chave
  precisa começar por `escolas/{schoolId}/`, e a barra final não é cosmética:
  sem ela `escolas/abc` alcança `escolas/abc2/...`. `list` e `deletePrefix`
  conferem também — é neles que o descuido deixa de ser um objeto errado e passa
  a ser o bucket inteiro.
- **Dois tetos de tamanho, de propósito.** `MAX_OBJECT_BYTES` é o arquivo do
  usuário (10 MB) e `MAX_BODY_BYTES` é ele já com os 28 bytes do envelope de
  cifragem. Com um teto só, o arquivo no limite passaria na validação de cima e
  seria recusado pela de baixo, falando de um tamanho que ninguém escolheu.
- **Versionamento do bucket fica desligado.** "Revogar apaga" não convive com
  versão anterior retida — e essa é a configuração que falha em silêncio.

Os segmentos fixos da chave (`escolas`, `alunos`, `documentos`) ficam em
português porque são dado gravado, na mesma convenção dos valores de enum do
banco (`biometria`, `foto_aberta`). Traduzi-los depois seria migração de dado.

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

### Erros de domínio

Service **não lança `TRPCError`** — lançaria HTTP dentro da regra de negócio.
Lança as classes de `packages/api/src/errors.ts`:

| Classe | Vira | HTTP |
| --- | --- | --- |
| `ConflictError` | `CONFLICT` | 409 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ValidationError` | `BAD_REQUEST` | 400 |

Um middleware em `packages/api/src/index.ts` faz a tradução para todas as
procedures, então nenhum resolver precisa tratar isso. Erro que não for
`DomainError` continua saindo como `INTERNAL_SERVER_ERROR` — o que é o certo:
falha inesperada não deve virar 4xx.

Ao criar um código novo de erro, acrescente-o ao union em `DomainError` **e** ao
mapa `DOMAIN_TO_TRPC`; o `satisfies` quebra a compilação se esquecer um dos
dois. `errors.test.ts` cobre a tradução.

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
| Design system | Varre o código-fonte | `packages/ui/src/design-system.test.ts` |
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

### Design system

A identidade visual vive em **`packages/ui/src/styles/integra-tokens.css`**:
paleta bruta (`--ie-*`) convertida dos mockups para oklch, os tokens shadcn
(`--primary`, `--card`, `--muted-foreground`…) redefinidos em cima dela, e raios
e semânticos de estado. `globals.css` o importa logo após os `@import` do
Tailwind/shadcn — o bloco `:root` neutro do scaffold foi removido de propósito:
era ele que sobrescrevia a identidade.

Três coisas que não são óbvias:

- **O app roda no tema claro**, sem `className="dark"`, porque os mockups
  aprovados são claros e a paleta do produto vive no `:root`. O bloco `.dark`
  continua sendo o neutro do scaffold: funciona, mas não está na identidade —
  falta o tema escuro do design.
- **`--radius` fica em `0.625rem`.** A escala do shadcn então produz `xl = 14px`
  e `3xl = 22px`, que são exatamente os raios do mockup. Mexer nele sem refazer
  as contas desalinha tudo.
- **Plus Jakarta Sans está declarada mas não vendorizada.** Hoje cai no fallback
  do sistema. O UI kit pede fonte local em `packages/ui/src/assets/fonts/`, não
  CDN — o app precisa funcionar sem rede externa e a métrica do fallback muda o
  layout.

**Componente não escreve cor.** Se precisou de um hex, falta um token.
`packages/ui/src/design-system.test.ts` reprova literal de cor em
`packages/ui/src/components/`, `packages/ui/src/integra/` e `apps/web/src/` —
`packages/ui/src/styles/` é a única exceção. Derivar de token é válido e a
regra reconhece: `oklch(from var(--primary) …)` e
`color-mix(in oklch, var(--muted), …)` passam.

**Os primitivos do shadcn foram ajustados à identidade, não envolvidos.**
`packages/ui/src/components/` continua sendo a pasta do `shadcn add`, mas os
arquivos foram editados: o estilo `base-lyra` vem com `rounded-none`, badge de
20px e corpo de 12px — o oposto do mockup. Em vez de criar um componente novo
por cima de cada um, mudamos a classe base no próprio arquivo e mantivemos a
API do shadcn.

> **Armadilha:** rodar `npx shadcn@latest add <componente> --overwrite` devolve
> o arquivo ao estilo original e **apaga o ajuste**. Ao regenerar, compare o
> diff antes de commitar.

O que foi ajustado, e por quê:

| Componente | Ajuste |
| --- | --- |
| `Card` | Raio de 22px, padding 24, **sem anel nem sombra** — a separação vem do azul do fundo |
| `Button` | Raio de 14px, altura mínima de 44px, corpo 13px; variantes `success` e `warning` |
| `Badge` | Pílula, com as variantes semânticas `success · warning · danger · info` |
| `Select` | Substitui o `<select>` nativo em todo o app (o nativo herda a caixa do SO) |
| `Table` | Linha sem borda: separa por fundo e espaçamento; cabeçalho no caixa-alta de 10px |
| `Input` / `Textarea` | 44px, fundo `muted`, sem borda visível |
| `Alert` | Variantes de estado; é o aviso de prazo, de pendência e de recusa |
| `Sidebar` | Variante `floating`: casca de 24px sobre o azul, e `Sheet` em tela estreita |
| `Tabs` / `Toggle` | Trilho segmentado do mockup |
| `Empty` | Base dos quatro estados obrigatórios |

> **Armadilha do Base UI:** `DropdownMenuLabel` é o rótulo de um grupo e
> exige um `DropdownMenuGroup` em volta. Sem ele o Base UI não acha o contexto
> e **derruba a árvore inteira** — o menu da conta virava "Something went
> wrong!". Não é erro de tipo nem de lint, só aparece ao clicar, então há uma
> regra mecânica em `packages/ui/src/design-system.test.ts`.

**Não existe barra de navegação inferior.** O produto é web: em tela estreita a
sidebar vira o `Sheet` do próprio shadcn, acionado pelo `SidebarTrigger`. Uma
`TabNav` no rodapé faria o app se passar por aplicativo nativo, que não é o que
estamos entregando.

### O que sobrou em `packages/ui/src/integra/`

Só o que o shadcn não cobre. Ficam fora de `components/` de propósito: aquela
pasta tem regras de a11y desligadas no `biome.json` por ser regenerável, e o
que é nosso continua sujeito a todas as regras.

| Primitivo | Por que não é shadcn |
| --- | --- |
| `StatCard` | Composição sobre o `Card`, não um primitivo novo |
| `SegmentedControl` | Escolha exclusiva e obrigatória. `ToggleGroup` é liga/desliga; aqui são `input[type=radio]` de verdade, então seta, agrupamento e "1 de 3" vêm do navegador |
| `GradeCell` | Célula de nota sobre o `Input`: quatro estados, e aceita vírgula |
| `BarComparison` | Gráfico de duas séries com o número ao lado |
| `EmptyState` / `ErrorState` / `PermissionState` / `ListSkeleton` | Os quatro estados do design brief, sobre `Empty` e `Skeleton` |

`initialsOf` vive em `packages/ui/src/lib/initials.ts` e alimenta o
`AvatarFallback`. **O tom vem do estado da linha, nunca do nome:** cor derivada
de hash vira informação falsa, porque o leitor tenta atribuir sentido a ela.

### CI

`.github/workflows/ci.yml` roda em push para `main` e em pull request, com um
serviço Postgres 18. Quatro portões, nesta ordem:

1. `pnpm exec biome ci .` — lint e formatação (`ci`, não `check --write`)
2. `pnpm run check-types`
3. `pnpm run test`
4. **Deriva de migration** — roda `drizzle-kit generate` e falha se aparecer
   arquivo novo, ou seja, se o schema mudou sem migration commitada

Mexeu em `packages/db/src/schema/`? Rode `pnpm run db:generate` e commite a
migration junto, senão o portão 4 reprova. Há um quinto passo que roda **só na
`main`**, o `publish` — ver "Do branch à produção".

Reproduzir o ambiente do CI localmente (sem arquivo `.env`, variáveis só no
ambiente) é a forma de pegar dependência acidental do `apps/web/.env`:

```bash
mv apps/web/.env apps/web/.env.bak
DATABASE_URL=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=... pnpm run test
mv apps/web/.env.bak apps/web/.env
```

### Do branch à produção

O produto está no ar em <https://orbitaedu.nasaex.com>, numa VPS gerenciada
com **Coolify**. Do merge ao container novo não há clique nenhum:

```
branch → PR (base: main) → CI verde → merge
                             → CI da main → imagem no GHCR → Coolify
```

O job `publish` do `ci.yml` roda **só em push para `main`**, nunca em PR. Antes
de publicar, ele **sobe a imagem contra um Postgres descartável e exige 200 em
`/api/health`** — prova que ela migra e atende, não só que compila. Só então
publica `ghcr.io/act962/integra-web` com duas etiquetas: `main`, que o Coolify
acompanha, e `sha-<commit>`, que existe para rollback.

**As migrations rodam na subida do container**, no `CMD` do
`apps/web/Dockerfile`, e só depois o servidor sobe (`exec`, para o node ser o
PID 1). Não é o *pre-deployment* do Coolify: aquele roda no container
**antigo**, com as migrations da versão anterior, e é pulado no primeiro
deploy. Migração que falha impede o servidor de subir, o healthcheck não
passa, e o Coolify mantém o container anterior no ar.

`runMigrations` (`packages/db/src/migrate.ts`) existe porque `drizzle-kit
migrate` engole a mensagem do Postgres e sai só com exit 1 — num deploy isso é
um log que não diz nada. Ele aplica o lote numa transação, sob lock advisory
(réplicas que sobem juntas), e devolve o erro inteiro.

**Rollback é trocar a etiqueta**, não reverter commit: no Coolify, app →
*Configuration → General → Tag*, troque `main` por um `sha-<commit>` anterior e
faça deploy; depois volte para `main`.

> **Armadilha, e a mais cara delas:** o rollback **não desfaz migration**. O
> banco fica no schema novo servindo código antigo. Pela mesma razão, durante o
> rolling update o container antigo atende alguns segundos com o schema já
> migrado. Então **toda migration precisa continuar funcionando com a versão
> anterior do app**: acrescente a coluna num deploy, remova a antiga só num
> seguinte.

Detalhes de infraestrutura, variáveis de produção e o roteiro tela a tela do
Coolify ficam em `docs/deploy/` — não os repita aqui.

> **Armadilha do healthcheck:** o check HTTP do painel do Coolify roda `curl`
> ou `wget` **dentro** do container, e `node:24-slim` não tem nenhum dos dois.
> Use o tipo **CMD** com o comando do roteiro. A imagem também traz um
> `HEALTHCHECK` próprio, pelo node, para valer fora do Coolify.

### Branch, PR e merge

**Branch curta, PR com base na `main`, mescla no mesmo dia.** Empilhar PR sobre
PR só quando um trabalho de fato depender de outro que ainda não entrou.

A pilha de 15 PRs encadeados de 22/09/2026 é o registro do custo: mesclar
exigiu reapontar a base de cada um para a `main` na ordem, sem parar; duas
migrations nasceram `0016` em branches paralelas e uma teve de ser regerada
como `0020`; um PR em rascunho travou a fila no meio; e a base se moveu três
vezes enquanto o merge era preparado. Nada disso é defeito de ferramenta — é o
preço de manter muita coisa aberta em paralelo.

Antes de mesclar uma pilha, mescle a base primeiro. `gh pr merge --merge
--match-head-commit <sha>` recusa a mescla se a branch andou desde a
verificação — use sempre, e passe o SHA **completo**.

### Configuração compartilhada

`packages/config/tsconfig.base.json` é a base dos pacotes. `apps/web/tsconfig.json`
é autônomo e define os aliases `@/*` e `@educa-escola/ui/*`.

Versões de dependência ficam centralizadas no `catalog:` do `pnpm-workspace.yaml`.
Ao adicionar ou subir uma dependência compartilhada, edite o catálogo — não fixe
versão por pacote.

## Convenções e armadilhas

- **A escola ativa é definida no login**, por um `databaseHooks.session.create`
  em `packages/auth/src/index.ts`. Sem ele a sessão nasce sem
  `activeOrganizationId` e toda `schoolProcedure` responde "nenhuma escola
  ativa" — o app sobe autenticado e inútil.
- **Sair precisa limpar o cache do React Query** (`queryClient.clear()` em
  `app-shell.tsx`). Sem isso o próximo login reaproveita as respostas da pessoa
  anterior até expirarem, incluindo `me`, que decide menu e painel. É
  vazamento entre contas, não só tela errada.
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
- **Arquivo vai para o bucket, nunca para uma coluna nova.** A camada é
  `packages/api/src/storage/`; ver "Armazenamento de arquivos". Quem consome
  monta por `storageFromEnv()` e embrulha com `createTenantStorage` — um teste
  de arquitetura reprova quem construir `createR2Storage` direto num service.
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
  (`packages/ui/src/integra/` e `apps/web/`) continua sujeito a todas as
  regras; a11y ali é dívida consciente, não isenção permanente.
- **Os arquivos de `components/` estão customizados.** Regenerar com
  `shadcn add --overwrite` devolve o estilo `base-lyra` e desfaz o ajuste de
  identidade. Ver "Design system".
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
