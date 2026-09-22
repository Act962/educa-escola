# Spec — Camada de armazenamento de objetos (Cloudflare R2)

> Spec aprovada. **O PR 1 (§11) está implementado** em
> `packages/api/src/storage/`; os PRs 2 e 3 continuam por fazer. O roteiro de
> provisionamento do bucket está em `docs/deploy/BUCKET-R2.md`.

## 1. O problema

Hoje o Órbita Edu não tem onde guardar arquivo. O único binário do sistema — a
foto do aluno — mora **dentro do Postgres**, como texto base64 cifrado nas
colunas `cipher`/`iv`/`auth_tag` de `student_photo`. Funciona para uma foto de
2 MB por aluno e não escala para nada além disso.

O requisito pede arquivo em praticamente todo módulo que ainda não existe:

| Onde | O quê | Requisito |
| --- | --- | --- |
| Documentos do aluno | Certidão, RG, comprovante de residência, laudo, histórico da escola anterior | §13.1, §13.2 |
| Documentos emitidos | Boletim, declaração, histórico, guia de transferência | §13.1 |
| Comunicados | Circular com anexo, autorização, regulamento | §16 |
| Atividades | Enunciado com anexo; entrega do aluno; anexo de devolutiva | §11.3 |
| Materiais | Arquivo, link, vídeo, por disciplina e turma | §11.4 |
| Frequência | Justificativa de falta com anexo | §10.7 |
| Identidade | Logotipo da escola, papel timbrado | §7 |

Nenhum desses módulos existe. **Construir a camada agora, antes deles, é o que
evita que cada um invente o seu jeito** — e é o pedido desta spec.

## 2. Escopo

**Entra:**

- A porta (`ObjectStorage`): a interface que o resto do app enxerga.
- O adaptador R2, usado em produção **e** nos testes de integração.
- O adaptador em memória, usado na suíte de regra de negócio e no CI sem segredo.
- O invólucro de tenant, que prende toda chave ao prefixo da escola.
- O invólucro de cifragem, que reaproveita o AES-256-GCM que já existe.
- A suíte de contrato: **um só conjunto de testes** rodado contra os dois
  adaptadores, para que "passa em memória" signifique "passa no R2".
- Variáveis de ambiente, `turbo.json`, `.env.example` e o roteiro do bucket.

**Não entra (e por quê):**

- **Nenhum módulo de domínio novo.** Documentos, anexos e materiais são telas, e
  tela passa pelo checklist do design brief antes do código. Esta spec entrega
  infraestrutura.
- **URLs pré-assinadas.** Ver §6 — é uma decisão em aberto, não um esquecimento.
- **Migrar a foto do aluno.** Ver §11 — é a fase 3, deliberadamente depois.
- **Antivírus / verificação de conteúdo malicioso** (§24.5). Fica registrado
  como pendência; a porta já prevê o ponto de costura.

## 3. As restrições que o produto já impõe

Estas não são preferências. São regras que já valem no código ou no requisito, e
qualquer desenho de storage que as quebre está errado antes de começar.

1. **Nenhum arquivo cruza escolas** (§24.2). O mesmo isolamento que os
   repositórios garantem com `eq(table.schoolId, tenant.schoolId)` precisa valer
   para chave de objeto. Em bucket único, prefixo esquecido é o filtro esquecido.
2. **Anexo não é acessível por endereço direto sem verificação de permissão**
   (§24.2, textual). Isso **exclui** bucket público, domínio `r2.dev` ligado e
   URL permanente. É a razão principal de a leitura passar pelo app.
3. **Cada leitura de documento sensível vira evento** (§13.3, e já implementado
   como `foto_aberta`). Um link pré-assinado entregue ao navegador não produz
   esse evento — quem baixa depois, baixa sem registro.
4. **Revogar apaga** (`photo/service.ts`). Não pode sobrar cópia. Isso proíbe
   versionamento de objeto no bucket e qualquer retenção automática.
5. **O que é sensível vai cifrado pela aplicação** (`media/crypto.ts`). A ameaça
   é credencial vazada, não datacenter invadido — e a credencial do R2 vai viver
   no mesmo `.env` que a `DATABASE_URL`. Cifragem do provedor não protege contra
   isso; a nossa protege.
6. **Query só em `repository.ts`** (`architecture.test.ts`). O adaptador de
   storage não toca no banco, então fica fora de `modules/`; a tabela de
   metadados, quando existir, entra num módulo com a forma de sempre.
7. **A migration precisa funcionar com a versão anterior do app** (rolling
   update). Vale para a fase 3.

## 4. Onde o código mora

```
packages/api/src/storage/
  port.ts               # ObjectStorage, tipos, erros. Sem dependência de SDK.
  keys.ts               # Monta e valida chave de objeto. Função pura.
  tenant.ts             # createTenantStorage(storage, tenant) — prende o prefixo
  encryption.ts         # createEncryptedStorage(storage, chave) — AES-256-GCM
  memory.ts             # Adaptador em memória
  r2.ts                 # Adaptador R2 (@aws-sdk/client-s3)
  index.ts              # createStorage(env) — escolhe o adaptador
  contract.ts           # A suíte de contrato, exportada como função
  memory.test.ts        # contrato + memória
  r2.test.ts            # contrato + R2 (pulado sem segredo)
  keys.test.ts
  tenant.test.ts
  encryption.test.ts
```

Fica ao lado de `media/` e `messaging/`, e não em `packages/storage`, porque é
exatamente a mesma forma que `messenger.ts` já tem: uma porta de infraestrutura
consumida só pela API, sem banco e sem tenant próprio. Pacote novo custaria
`package.json`, `tsconfig`, `vitest.config` e uma aresta no grafo para não
resolver nada. **Se um dia o seed ou o script de provisionamento precisar
escrever arquivo, aí o pacote se justifica** — e mover é mecânico.

## 5. A porta

```ts
/** packages/api/src/storage/port.ts */

export interface PutResult {
  key: string;
  etag: string;
  size: number;
}

export interface ObjectContent extends PutResult {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}

export interface ObjectHead extends PutResult {
  contentType: string;
  metadata: Record<string, string>;
  modifiedAt: Date;
}

export interface PutInput {
  key: string;
  body: Buffer;
  contentType: string;
  /** Metadados do provedor. Nunca dado pessoal — ver §7. */
  metadata?: Record<string, string>;
  /** Recusa se a chave já existir, em vez de sobrescrever. */
  onlyIfAbsent?: boolean;
}

export interface ObjectStorage {
  put(input: PutInput): Promise<PutResult>;
  /** Lança `ObjectNotFoundError`. Não devolve `null` — ver a nota abaixo. */
  get(key: string): Promise<ObjectContent>;
  /** `null` quando não existe. É a consulta barata de existência. */
  head(key: string): Promise<ObjectHead | null>;
  delete(key: string): Promise<{ deleted: boolean }>;
  list(
    prefix: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<{ keys: string[]; cursor: string | null }>;
  /**
   * Apaga tudo sob um prefixo. Existe para o encerramento de escola e para a
   * limpeza da suíte de integração.
   */
  deletePrefix(prefix: string): Promise<{ deleted: number }>;
}
```

Cinco escolhas que valem explicação:

- **`get` lança e `head` devolve `null`.** São perguntas diferentes: quem
  chama `get` já decidiu que o objeto deve existir — se não existe, é
  inconsistência entre banco e bucket, e engolir isso num `null` empurra o erro
  para longe da causa. Quem quer saber se existe chama `head`.
- **`Buffer`, não stream.** Simplifica adaptador, teste e cifragem. O custo é um
  teto de tamanho: **10 MB por objeto**, validado na porta. Documento escolar
  cabe; vídeo de aula não — e vídeo, quando entrar (§11.4), pede stream e
  multipart, que é mudança de porta consciente, não um `if` a mais.
- **`deletePrefix` na porta, e não só no adaptador.** Encerrar o vínculo de uma
  escola tem de apagar os arquivos dela, e isso precisa de teste.
- **Sem `copiar` e sem `mover`.** Nenhum consumidor previsto precisa, e método na
  porta que ninguém chama é o que apodrece.
- **Sem URL.** A porta não devolve endereço; devolve bytes. Ver §6.

### Erros

```ts
export class StorageError extends Error {}
export class ObjectNotFoundError extends StorageError {}
export class ObjectAlreadyExistsError extends StorageError {}
export class EmptyObjectError extends StorageError {}
export class ObjectTooLargeError extends StorageError {}
export class KeyOutsideTenantError extends StorageError {}
export class StorageUnavailableError extends StorageError {} // rede, credencial, 5xx
```

**Classes próprias, e não as de `errors.ts`.** O storage é infraestrutura: ele
não sabe se "não encontrado" vira 404 para o usuário ou vira log de
inconsistência. Quem traduz é o service do módulo consumidor — do mesmo jeito
que o repositório não lança `TRPCError`.

`KeyOutsideTenantError` **nunca deveria chegar ao usuário**: é falha de programação,
como uma query sem filtro de escola. Vira 500 e alarme, não 400.

## 6. Leitura: pelo app, não por URL pré-assinada

**Decisão: a leitura passa pelo servidor.** O app lê do R2 e devolve os bytes; o
navegador nunca fala com o R2.

Quebra se for pré-assinada:

- §24.2 diz, com todas as letras, que anexo não é acessível por endereço direto
  sem verificação de permissão. Link assinado é endereço direto; a verificação
  aconteceu uma vez, e o link continua valendo depois disso.
- §13.3 pede registro de **cada** leitura. Um link entregue ao navegador é lido
  quantas vezes quiserem, e só a primeira aparece no registro.
- A foto e os documentos sensíveis estão cifrados pela aplicação. Um link
  pré-assinado entrega **texto cifrado** ao navegador, que não tem a chave. Para
  esses, a URL assinada não é só insegura: é inútil.

O que isso custa: banda do servidor e memória por requisição. É aceitável —
egresso do R2 para o app é gratuito, o teto é 10 MB, e o volume de uma escola de
documentos escolares não é volume de streaming.

**Upload direto (`PUT` pré-assinado) fica em aberto** — `[DECISÃO-JOÃO]` na §13.
Só passa a valer a pena com arquivo grande (vídeo de aula), e aí vem junto com a
mudança para stream.

## 7. A chave do objeto

```
escolas/{schoolId}/{domínio}/{entityId}/{ulid}
```

Exemplo: `escolas/9f3c…/alunos/7ab1…/01JBQ8ZK3M4P5R6S7T8V9W0XYZ`

Regras, e cada uma tem um motivo:

- **O `schoolId` vem primeiro.** Permite token do R2 escopado por prefixo, torna
  "apague tudo desta escola" uma operação de prefixo, e faz o vazamento entre
  escolas exigir uma chave visivelmente errada em vez de um filtro ausente.
- **A chave não carrega o nome original do arquivo.** `laudo-joao-tdah.pdf` é
  dado pessoal sensível escrito no nome; o nome original vai na tabela de
  metadados, junto do resto, sob o mesmo controle de acesso. A chave é um ULID.
- **A chave não carrega extensão.** Extensão no fim da chave convida a servir o
  objeto pelo que o nome diz em vez de pelo que o `contentType` gravado diz.
- **ULID e não UUID** porque ordena por tempo, o que faz `listar` com prefixo
  devolver em ordem cronológica de graça.
- **A chave é opaca ao usuário e nunca vem da entrada.** Quem monta é
  `keys.ts`, a partir do tenant e do id da entidade — igual ao `schoolId` da
  criação vir sempre do tenant, nunca do `input`.

### O invólucro de tenant

```ts
const storage = createTenantStorage(storageBruto, ctx.tenant);
```

Toda operação confere que a chave começa por `escolas/{tenant.schoolId}/`; se não
começar, lança `KeyOutsideTenantError` **antes** de falar com o R2. É a camada 2 do
isolamento — a mesma ideia de "repositório exige o tenant na construção",
aplicada a objeto.

**Um teste de arquitetura novo** garante que nada fora de `storage/` importe
`@aws-sdk/*`, e que nenhum router ou service construa o adaptador cru em vez do
embrulhado. Igual à regra do `drizzle-orm`: mecânica, não cultural.

## 8. Cifragem

`createEncryptedStorage(storage, chave)` embrulha qualquer `ObjectStorage` e
cifra o corpo com o AES-256-GCM que já está em `media/crypto.ts`.

O formato no bucket é **`iv ‖ authTag ‖ texto cifrado`**, um binário só.

Quebra se o `iv` e o `authTag` forem para os metadados do objeto: metadado do S3
não é autenticado pela etiqueta, é perdido em cópia entre buckets e aparece em
log de ferramenta. Guardados no corpo, o objeto é autossuficiente — ou abre
inteiro, ou não abre.

Quem decide se cifra é o módulo consumidor, na montagem:

| Conteúdo | Cifrado? | Por quê |
| --- | --- | --- |
| Foto do aluno, molde facial | Sim | Biometria de menor |
| Documento recebido (laudo, certidão, RG) | Sim | §24.3, dado sensível |
| Documento emitido (boletim, declaração) | Sim | Identifica aluno e nota |
| Logotipo, papel timbrado | Não | Público por natureza |
| Material de aula | Não | É conteúdo do professor |

**Sem `MEDIA_ENCRYPTION_KEY`, o storage cifrado recusa gravar** — mesmo
comportamento que já existe para a foto, e pela mesma razão: arquivo gravado em
claro "só desta vez" é o que ninguém descobre até ser tarde.

## 9. Configuração

### Variáveis (`packages/env/src/server.ts`)

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `STORAGE_DRIVER` | não (`memory`) | `r2` ou `memory` |
| `R2_ACCOUNT_ID` | se `r2` | Monta o endpoint |
| `R2_ACCESS_KEY_ID` | se `r2` | Token S3 do R2 |
| `R2_SECRET_ACCESS_KEY` | se `r2` | Token S3 do R2 |
| `R2_BUCKET` | se `r2` | Bucket de produção |
| `R2_ENDPOINT` | não | Sobrescreve o endpoint padrão |
| `R2_TEST_BUCKET` | não | Liga a suíte de integração contra o R2 |

O endpoint padrão é `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, e a
região é `auto` — o SDK exige uma, o R2 ignora.

Todas **opcionais no schema**, com validação cruzada: `STORAGE_DRIVER=r2` sem as
quatro do R2 derruba o boot com a lista do que falta. É o padrão que
`MEDIA_ENCRYPTION_KEY` e `ORBITA_BASE_URL` já seguem — o app sobe, e quem tenta
usar recebe instrução em vez de falha obscura.

> **Armadilha:** variável nova precisa entrar **também** em `turbo.json`
> (`tasks.test.env` e `tasks.test:watch.env`) e no `.env.example`. O Turbo roda
> em `envMode` strict: o que não está declarado não chega à tarefa. No local
> passa despercebido, porque o `@educa-escola/env` lê o `.env` do disco; no CI
> não há arquivo, e a variável simplesmente não existe.

### O bucket

Dois buckets na mesma conta Cloudflare:

| Bucket | Uso |
| --- | --- |
| `orbitaedu-prod` | Produção |
| `orbitaedu-test` | Suíte de integração |

Configuração dos dois, e cada linha é uma regra da §3:

- **Acesso público desligado.** Sem domínio `r2.dev`, sem domínio customizado. O
  único que fala com o bucket é o servidor, com token.
- **Versionamento desligado.** Revogação que deixa versão anterior não é
  revogação (§3.4).
- **Sem regra de retenção nem lock de objeto.** Mesmo motivo.
- **Token S3 com permissão só nos dois buckets**, e o de produção sem acesso ao
  de teste.
- **Localização:** sem dado para decidir — fica `[DECISÃO-JOÃO]`, e o automático
  serve.

O bucket de teste ganha uma **regra de ciclo de vida apagando objetos com mais de
1 dia**. A suíte limpa o que cria; a regra é a rede embaixo, para o dia em que um
teste morrer no meio.

## 10. A suíte de testes

O ponto central: **um contrato só, dois adaptadores**. Se o teste de memória for
outro texto que o teste do R2, "passa em memória" deixa de significar alguma
coisa — e é justamente aí que o dublê mente.

```ts
/** storage/contract.ts */
export function testObjectStorageContract(
  name: string,
  create: () => Promise<{ storage: ObjectStorage; prefix: string; cleanup: () => Promise<void> }>,
) {
  describe(`contrato de ObjectStorage — ${name}`, () => {
    /* … */
  });
}
```

```ts
// memory.test.ts
testObjectStorageContract("memória", async () => ({
  storage: createMemoryStorage(),
  prefix: "escolas/contrato-em-memoria/",
  cleanup: async () => {},
}));

// r2.test.ts — pulado, com aviso, quando não há segredo
const config = /* as quatro variáveis R2_*, ou null */;
describe.skipIf(!config)("R2", () => {
  testObjectStorageContract("R2", async () => {
    const prefix = `escolas/testes-${randomUUID()}/`; // isola execuções paralelas
    // …
  });
});
```

### O que o contrato cobre

| # | Caso | Por que importa |
| --- | --- | --- |
| 1 | Gravar e ler devolve os mesmos bytes | O básico |
| 2 | Gravar e ler preserva `contentType` e metadados | O R2 normaliza chave de metadado para minúscula — a memória tem de fazer igual, senão o dublê mente |
| 3 | Ler chave inexistente lança `ObjectNotFoundError` | Contrato de erro |
| 4 | `head` de chave inexistente devolve `null` | Contrato de erro |
| 5 | Regravar a mesma chave substitui | Recapturar foto substitui, não acumula |
| 6 | `onlyIfAbsent` recusa a segunda gravação | Idempotência de importação |
| 7 | Apagar devolve `deleted: true`; apagar de novo, `false` | Revogação precisa saber se havia |
| 8 | Listar por prefixo devolve só o prefixo | A base do isolamento |
| 9 | Listar pagina, e o cursor avança sem repetir nem pular | O R2 pagina em 1000; a memória precisa paginar também, senão o defeito só aparece na escola grande |
| 10 | `deletePrefix` apaga tudo sob ele e nada fora | Encerramento de escola |
| 11 | Corpo vazio é recusado | Upload que falhou no meio |
| 12 | Corpo acima de 10 MB é recusado | Teto da porta |
| 13 | Bytes binários (não-UTF8) sobrevivem intactos | Onde o adaptador que trata `Buffer` como string quebra |
| 14 | Chave com acento, espaço ou `..` é rejeitada | A assinatura do S3 é sensível a isso |

### Fora do contrato (só num adaptador)

| Arquivo | Cobre |
| --- | --- |
| `keys.test.ts` | Montagem da chave; recusa de `..`, de chave absoluta e de id vazio |
| `tenant.test.ts` | Toda operação recusa chave de outra escola — inclusive `delete`, `list` e `deletePrefix`, que é onde se esquece |
| `encryption.test.ts` | Ida e volta; adulterar um byte do corpo faz `get` lançar; sem chave, `gravar` recusa; o que está no adaptador de baixo **não** contém o texto claro |
| `r2.test.ts` (extra) | Credencial errada vira `StorageUnavailableError`, não erro cru do SDK |
| `architecture.test.ts` | Ninguém fora de `storage/` importa `@aws-sdk/*` |

### No CI

O CI roda **sem** segredo do R2: o contrato passa em memória e os testes do R2
são pulados. O `skipIf` imprime a razão, para que "0 testes de R2" não seja
confundido com "R2 verde".

Um passo **só na `main`**, com os segredos do repositório, roda a suíte do R2
contra `orbitaedu-test`. É o mesmo lugar onde o `publish` já prova a imagem
contra um Postgres descartável.

> **Armadilha:** PR vindo de fork não recebe segredo. Por isso o contrato precisa
> ser verde em memória sozinho — se o teste de R2 for o único que cobre um caso,
> esse caso não é coberto em PR nenhum.

## 11. Entrega, em três PRs

### PR 1 — a camada (esta spec)

Porta, adaptadores, invólucros, suíte de contrato, env, `turbo.json`,
`.env.example`, roteiro do bucket em `docs/deploy/`. **Nenhum consumidor.**

Fica infraestrutura sem uso por alguns dias, o que é o pedido — mas é o único PR
da lista que não entrega nada visível, e o PR 2 deve vir logo atrás.

### PR 2 — o primeiro consumidor: documentos do aluno

`modules/arquivo/` com a forma de sempre (`schema` · `repository` · `service` ·
`router`), e uma tabela `stored_file`:

| Coluna | Para quê |
| --- | --- |
| `id`, `schoolId` | O de sempre |
| `storageKey` | A chave no bucket |
| `ownerType` / `ownerId` | De que registro este arquivo pende (§24.2: herda o escopo da origem) |
| `originalName` | O nome que o usuário enviou — aqui, sob controle de acesso, e não na chave |
| `contentType`, `sizeBytes`, `checksum` | Conferência e exibição |
| `encrypted` | Se o corpo está cifrado |
| `uploadedByUserId`, `uploadedAt` | Quem mandou |
| `deletedAt` | Ver a armadilha abaixo |

Aqui é que a leitura vira evento e a permissão é conferida por tipo de documento
(§13.2). A tela passa antes pelo checklist do design brief.

> **Armadilha das duas verdades:** banco e bucket não têm transação em comum.
> Gravar a linha e falhar no `put` deixa registro sem arquivo; gravar o objeto e
> falhar o `insert` deixa objeto órfão, que ninguém vê e ninguém apaga.
> **A ordem é: objeto primeiro, linha depois.** Órfão é lixo mensurável, que uma
> rotina varre comparando `list(prefixo)` com a tabela; linha apontando para o
> nada é erro na cara do usuário. E a rotina de varredura só apaga objeto com
> mais de 24 h sem linha, senão ela mesma corre contra um upload em andamento.

### PR 3 — migrar a foto do aluno

Fica por último de propósito: é o caminho mais sensível do sistema e o único que
já funciona. Trocar o que funciona antes de o resto provar a camada é inverter o
risco.

A sequência respeita a regra de rolling update — **toda migration precisa
funcionar com a versão anterior do app**:

1. **Deploy A** — migration acrescenta `student_photo.storage_key` (nulável). O
   app grava **nos dois lugares** e lê da coluna, como hoje. A versão anterior
   continua funcionando, porque as colunas velhas seguem preenchidas.
2. **Backfill** — script lê cada foto, grava no R2, preenche `storage_key`.
   Idempotente pela presença da chave.
3. **Deploy B** — o app lê do R2 e para de gravar nas colunas velhas.
4. **Deploy C** — migration remove `cipher`, `iv`, `auth_tag`.

Na revogação, **o objeto é apagado antes da linha**, ao contrário do upload: se
falhar no meio, sobra linha apontando para nada (erro visível) em vez de foto de
criança num bucket depois de a família ter pedido para apagar.

O molde facial (`student_face_template`) **não vai para o R2**: é um vetor de
poucos KB que a portaria compara a cada leitura, e buscar no bucket a cada
passagem no portão troca uma consulta local por uma ida à rede.

## 12. Riscos

| Risco | O que acontece | O que segura |
| --- | --- | --- |
| Objeto órfão | Lixo acumulando e custo | Ordem de escrita + varredura de 24 h (§11) |
| Linha órfã | Tela quebra ao abrir o documento | Ordem de escrita; `get` lança em vez de devolver `null` |
| Chave de outra escola | Vazamento entre instituições | `createTenantStorage` + teste de arquitetura |
| R2 fora do ar | Upload e download param | `StorageIndisponivel` com mensagem clara; o resto do app segue |
| Credencial vazada | Acesso a todos os arquivos | Corpo cifrado no bucket; a chave de cifragem não está no R2 |
| Versionamento ligado por engano no painel | Revogação deixa cópia | Item explícito no roteiro de `docs/deploy/` |
| Bucket público por engano | §24.2 violada | Idem, e vale uma conferência periódica |
| Dev sem persistência | `memory` perde tudo no restart | Ver `[DECISÃO-JOÃO]` na §13 |

## 13. Pendências

- **`[DECISÃO-JOÃO]` Adaptador de disco local para desenvolvimento.** Com
  `STORAGE_DRIVER=memory`, todo upload some ao reiniciar o servidor. Um terceiro
  adaptador escrevendo em `.storage/` resolveria, ao custo de mais um adaptador
  para manter em contrato. A alternativa é cada desenvolvedor usar o bucket de
  teste, o que significa distribuir credencial do R2 para todas as máquinas.
- **`[DECISÃO-JOÃO]` Upload direto por URL pré-assinada.** Hoje não; ver §6. A
  pergunta é se haverá vídeo de aula (§11.4) no horizonte próximo.
- **`[DECISÃO-JOÃO]` Localização do bucket** (`enam`, `apac`, automático).
- **Pendente:** verificação de conteúdo malicioso em arquivo enviado (§24.5).
  Validar tipo e tamanho a camada já faz; antivírus é serviço externo e decisão à
  parte.
- **Pendente:** cópia de segurança dos objetos (§24.5 pede backup com teste de
  restauração). O R2 não versiona por decisão nossa, então backup, se houver, é
  cópia para outro bucket — e precisa conviver com "revogar apaga".
