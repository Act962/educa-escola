# Spec — Integração nativa com o WhatsApp

> **Estado: aprovada.** Aprovada pelo João em 22/09/2026, no pedido que
> originou esta branch, como registro do que vai ser construído — não como
> contrato fechado. O que estiver marcado `[A VALIDAR]` continua sendo decisão
> dele; o resto está implementado ou é a próxima fase declarada.

---

## 1. O problema

A escola fala com a família por WhatsApp. Não é preferência: é onde a mãe lê.
E-mail de responsável envelhece, caixa postal enche, SMS custa e some.

Hoje o sistema sabe disso e não faz nada a respeito. A costura existe desde a
matrícula — `packages/api/src/messaging/messenger.ts` declara
`EnrollmentMessenger` e a única implementação, `createManualMessenger`,
devolve `delivered: false` com "copie o link e mande ao responsável". É honesto
e é manual: alguém da secretaria abre o WhatsApp Web, procura o contato, cola
o link. Trinta matrículas é uma tarde.

O que falta não é um `fetch` para a Graph API. É **o que precisa existir em
volta dele** para a escola operar sozinha:

- credencial por escola, guardada com o cuidado de credencial;
- **modelo de mensagem** (template), que na API oficial é obrigatório para
  iniciar conversa — e que hoje só se cria no painel da Meta, fora do produto;
- registro do que foi enviado, para quem e o que aconteceu depois;
- e uma fronteira que permita trocar o fornecedor sem reescrever o domínio.

Esse último ponto é a razão de esta spec existir antes do código. **Neste
momento estamos avaliando a API oficial da Meta e alternativas não oficiais ao
mesmo tempo.** Escrever para a Meta direto dentro dos services seria escolher
agora, por inércia, uma decisão que ainda está aberta.

---

## 2. Escopo

### Entra nesta entrega (o MVP)

1. A **porta** `WhatsAppChannel` e o primeiro adaptador, `cloud` — a API oficial
   da Meta (WhatsApp Cloud API).
2. O adaptador `memoria`, dublê que roda em todo PR e sustenta a demonstração
   sem número de verdade.
3. A **aba WhatsApp dentro de Configurações**, visível só para a direção.
4. Cadastro da credencial do número: `phoneNumberId`, `wabaId` (o Business
   Account), `appId`, o token de acesso e o `appSecret`. Mais de um número cabe
   no modelo; a tela mostra um.
5. **Editor de modelos de mensagem** com prévia — cabeçalho, corpo, rodapé,
   botões e variáveis — e envio para aprovação da Meta pelo próprio sistema.
6. Envio de teste para um número, com registro do resultado.
7. Log de envios: para quem, qual modelo, o que o provedor respondeu.
8. **O contador da cota gratuita** — §12, acrescentado depois da primeira
   entrega, quando ficou claro que a Meta passaria a cobrar por mensagem.

### Fica para a fase seguinte

- **Recebimento** (webhook de entrada) e conversa de mão dupla.
- Disparo em massa ligado a público (turma, turno, toda a escola) — o recorte já
  existe em `communication/service.ts`, falta plugar o canal.
- Troca do `createManualMessenger` pelo canal real no fluxo de matrícula.
- Mídia (imagem, PDF do boletim) no cabeçalho do modelo.
- Adaptador não oficial.

A razão de cortar aí é uma só: **o MVP precisa provar a fronteira**, e a
fronteira se prova com um adaptador funcionando de ponta a ponta, não com dois
pela metade.

---

## 3. As restrições que a API oficial impõe

Não são detalhes de implementação — são o desenho do produto.

| Restrição da Meta | O que ela obriga aqui |
| --- | --- |
| Conversa só começa por **modelo aprovado** | O editor de modelos não é luxo; sem ele a escola depende do painel da Meta |
| Texto livre só dentro da **janela de 24h** desde a última mensagem do usuário | A porta tem dois métodos, e o de texto livre falha explicando isso |
| Modelo aprovado assincronamente (minutos a horas) | O status local é uma **cópia**, e existe um botão de sincronizar |
| Variáveis são posicionais: `{{1}}`, `{{2}}` | O editor nomeia as variáveis para quem escreve e numera para a Meta |
| Nome do modelo é `snake_case`, único por conta | Validado antes de enviar, com mensagem em português |
| Corpo até 1024 caracteres; cabeçalho e rodapé até 60 | Contador na tela, recusa no service |
| Token do sistema expira; token permanente vem de System User | A tela diz qual é qual, e o teste de conexão informa antes de falhar em produção |

E a que mais importa: **número de telefone de família é dado pessoal.** O que
guardamos é o E.164 que já está em `enrollment_guardian`, e o registro de envio
não duplica cadastro — aponta para a linha que já existe.

---

## 4. Onde o código mora

```
packages/api/src/messaging/whatsapp/
  port.ts        a porta, os erros, os tipos de modelo
  template.ts    o modelo de mensagem como dado puro: validação e prévia
  cloud.ts       adaptador da API oficial da Meta. Único que conhece a Graph API
  memory.ts      dublê determinístico: testes e demonstração
  contract.ts    a suíte que os dois adaptadores precisam passar
  index.ts       fábrica: escolhe o adaptador a partir da conta da escola

packages/api/src/modules/whatsapp/
  schema.ts      entradas em Zod
  secret.ts      cifragem do token e do app secret
  repository.ts  único lugar que monta query
  service.ts     regra de negócio
  router.ts      procedures tRPC

packages/db/src/schema/whatsapp.ts
apps/web/src/components/whatsapp/*
```

O mesmo arranjo de `storage/`: porta, adaptadores, contrato compartilhado. E a
mesma regra mecânica — `architecture.test.ts` ganha uma linha reprovando quem
falar com `graph.facebook.com` fora de `messaging/whatsapp/`.

---

## 5. A porta

```ts
export interface WhatsAppChannel {
  /** Confere a credencial e devolve o que o provedor sabe do número. */
  verificar(): Promise<NumeroVerificado>;

  /** Inicia conversa. É o caminho normal: modelo aprovado, variáveis. */
  enviarModelo(input: EnvioDeModelo): Promise<EnvioAceito>;

  /** Texto livre. Só vale dentro da janela de 24h — e falha dizendo isso. */
  enviarTexto(input: EnvioDeTexto): Promise<EnvioAceito>;

  listarModelos(): Promise<ModeloRemoto[]>;
  criarModelo(modelo: ModeloDeMensagem): Promise<ModeloRemoto>;
  apagarModelo(nome: string): Promise<{ apagado: boolean }>;

  /** O que este fornecedor sabe fazer. Nem todos fazem tudo. */
  readonly recursos: RecursosDoCanal;
}
```

Três decisões dentro dessa forma:

**`enviarModelo` e `enviarTexto` são métodos diferentes**, e não um método com
flag. São operações com regras distintas na origem: uma pode começar conversa,
a outra não. Um método só faria o service decidir por um booleano o que o
fornecedor decide por contrato — e o erro apareceria em produção, como
mensagem não entregue.

**`recursos` existe porque o próximo adaptador não vai ter modelos.** É o ponto
em que uma API não oficial difere de verdade: ela manda texto livre para quem
quiser e não conhece aprovação da Meta. Sem um descritor, a aba de modelos
apareceria vazia e sem explicação. Com ele, a tela diz "este fornecedor não usa
modelos aprovados" — que é informação, não falha.

**A porta devolve "aceito", não "entregue".** `EnvioAceito` carrega o id da
mensagem no provedor e o estado inicial. Entrega e leitura chegam por webhook,
que está fora deste MVP: prometer `entregue` no retorno da chamada seria
mentir, e é o tipo de mentira que só aparece quando alguém pergunta por que a
mensagem não chegou.

### Erros

Classes próprias, como em `storage/port.ts`, e pelo mesmo motivo: o canal não
sabe se "número inválido" vira 400 na tela ou linha de log num disparo em
massa. Quem traduz é o service.

| Classe | Quando |
| --- | --- |
| `CredencialRecusadaError` | 401/403 da Meta: token errado, expirado ou sem escopo |
| `NumeroInvalidoError` | Destinatário fora do E.164 ou sem WhatsApp |
| `ForaDaJanelaError` | Texto livre sem janela de 24h aberta |
| `ModeloInvalidoError` | A Meta recusou o modelo, com o motivo dela |
| `CanalIndisponivelError` | 5xx, prazo estourado, DNS |
| `RecursoNaoSuportadoError` | O fornecedor não faz isso (ver `recursos`) |

---

## 6. O modelo de mensagem

`template.ts` é código puro — sem rede, sem banco, sem tela — porque é onde
mora a regra que a Meta cobra e que a escola não conhece.

```ts
interface ModeloDeMensagem {
  nome: string;                 // snake_case, único na conta
  categoria: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  idioma: string;               // "pt_BR"
  cabecalho?: { tipo: "texto"; texto: string };
  corpo: string;                // com {{1}}, {{2}}…
  rodape?: string;
  botoes?: Botao[];             // resposta rápida, link ou telefone
  exemplos: string[];           // um por variável do corpo
}
```

**As variáveis são nomeadas na tela e posicionais no envio.** Quem escreve o
comunicado digita `{{nome_do_aluno}}`; o que vai para a Meta é `{{1}}`, com o
mapa guardado ao lado. A alternativa — expor `{{1}}` para a secretaria — já
custou erro em todo produto que a adotou: numa mensagem com quatro variáveis
ninguém lembra qual é a 3.

A validação recusa, com mensagem em português, o que a Meta recusaria depois de
horas de espera: nome fora do `snake_case`, corpo vazio ou acima de 1024,
variável no começo ou no fim do corpo (a Meta rejeita), numeração com buraco,
exemplo faltando, mais de 3 botões de resposta rápida, mais de 2 de ação.

`renderizar(modelo, valores)` devolve o texto final. É o que alimenta a prévia
da tela e o registro do envio — **a mesma função nos dois**, para o que a
direção viu antes de enviar ser exatamente o que ficou gravado.

---

## 7. O banco

Três tabelas, todas com `schoolId`.

### `whatsapp_account` — o número conectado

Uma linha por número. Mais de uma por escola é permitido pelo modelo e a tela
mostra a principal — porque escola com duas unidades vai querer dois números, e
descobrir isso depois custaria migração de dado.

O token e o app secret vão **cifrados em AES-256-GCM**, com
`WHATSAPP_ENCRYPTION_KEY` fora do banco, exatamente como a credencial do Astro
(`assistant_settings`) e pela mesma ameaça: a `DATABASE_URL` mora num `.env`.
Aqui o custo de vazar é maior que dinheiro — um token de WhatsApp Business
manda mensagem em nome da escola para a lista de famílias dela.

`tokenHint` guarda os quatro últimos caracteres em claro, para a tela dizer
*qual* token está gravado sem nunca recebê-lo de volta. `phoneNumberId`,
`wabaId` e `appId` ficam em claro: são identificadores de conta, não segredos,
e cifrá-los só atrapalharia a direção a conferir se pôs o certo.

### `whatsapp_template` — os modelos

Espelho local do que existe na Meta, mais os rascunhos que ainda não foram
enviados. O `status` local (`rascunho`, `enviado`, `aprovado`, `recusado`,
`pausado`) é **cópia** do estado remoto: a verdade é da Meta, e `sincronizadoEm`
diz de quando é a cópia. Tela que mostra "aprovado" sem dizer quando conferiu é
tela que mente devagar.

### `whatsapp_message` — o que saiu

Uma linha por envio: destinatário, modelo, o texto renderizado, o id do
provedor, o estado e o erro. O texto renderizado fica gravado de propósito —
é o que responde "o que exatamente foi mandado para essa família", que é a
pergunta que aparece quando há reclamação. É conteúdo da escola, não conteúdo
de criança: a distinção é a mesma que `assistant_usage` faz ao **não** guardar
a pergunta do aluno.

---

## 8. Permissões

`whatsapp: ["manage", "send"]` no `statement`.

- `owner` e `admin`: os dois. A direção assina o contrato com a Meta, a
  secretaria opera o dia a dia — o mesmo arranjo do Astro.
- `teacher` e `student`: nenhum. Professor falando com a família pelo número
  oficial da escola é decisão pedagógica e administrativa que ninguém tomou
  ainda. `[A VALIDAR]`

A leitura também fica atrás de `manage` — a aba mostra credencial, número e
lista de destinatários, que é mapa de contato de família.

---

## 9. A tela

Uma aba dentro de Configurações, ao lado de "Instituição". Aparece só para quem
tem a permissão; quem não tem não vê a aba **e** recebe 403 se forjar a rota.

Três seções, na ordem em que a escola as usa:

1. **Número** — as credenciais, com um "Testar conexão" que bate na Meta e
   devolve o nome verificado, o número formatado e a qualidade da conta. É o
   passo que transforma "salvei uns campos" em "está no ar".
2. **Modelos** — lista com status, e o editor: campos à esquerda, prévia de
   celular à direita, atualizando enquanto digita. Enviar para aprovação é um
   botão, e o status volta pelo "Sincronizar".
3. **Envios** — o teste ("mandar este modelo para este número") e o histórico.

Responsivo pelo mesmo caminho do resto do produto: coluna única abaixo de
`md`, a prévia acima do formulário no celular — porque quem confere a mensagem
no celular quer ver a mensagem, não o formulário.

---

## 10. Testes

| Camada | Como |
| --- | --- |
| `template.ts` | Puro: validação e renderização, sem I/O |
| Porta | `contract.ts` roda contra `memoria`; contra `cloud` só com credencial no ambiente |
| `cloud.ts` | `fetch` dublado: corpo da requisição e tradução de erro |
| Service | Dublê do repositório e do canal, tipados como os reais |
| Repositório | Postgres real em transação revertida |
| Arquitetura | Ninguém fala com a Graph API fora de `messaging/whatsapp/` |

O contrato compartilhado existe pelo motivo do `storage/contract.ts`: "passa em
memória" precisa significar "passa na Meta". Dublê que aceita o que o
fornecedor recusa é pior que não ter dublê.

---

## 11. Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `WHATSAPP_ENCRYPTION_KEY` | 32 bytes em base64. Cifra token e app secret |
| `WHATSAPP_API_VERSION` | Versão da Graph API. Padrão `v21.0` |
| `WHATSAPP_DRIVER` | `cloud` ou `memoria`. Padrão `cloud`; `memoria` para demonstrar |

Todas opcionais no schema, declaradas em `packages/env/src/server.ts`, no
`.env.example` e no `turbo.json` — sem a última, `envMode: strict` não as
entrega à tarefa no CI.

Chave própria, e não a do Astro, pela razão já registrada lá: girar uma por
incidente não deve obrigar a recadastrar a outra.

---

## 12. A cota gratuita, e por que ela é uma estimativa

A Meta cobra por mensagem, e dá de graça as **primeiras mil conversas de
serviço de cada mês** — as que acontecem dentro da janela de 24 horas aberta
por quem escreveu para a escola. Mensagem por modelo é cobrada por mensagem e
**não** sai dessa cota.

Sem um contador, a escola descobre o estouro na fatura. Com um contador que
conta a coisa errada, ela se contém à toa. As duas coisas custam caro, e a
segunda é a mais fácil de construir por engano.

### A unidade é conversa, não mensagem

Cinco mensagens para a mesma família em duas horas são **uma** conversa para a
Meta. Um painel que contasse mensagens acusaria cinco — e a secretaria pararia
de responder por causa de um número inventado por nós.

Por isso cada envio decide, **antes de sair**, se abre conversa nova: há envio
de serviço para aquele número nas últimas 24 horas? A resposta vira a coluna
`opened_conversation`, e é ela que o contador soma. Gravada, e não recalculada
na leitura, porque a decisão foi tomada com os dados de um instante que não
volta.

### Três coisas que nos escapam, e por isso "estimativa"

1. **A janela abre quando a família escreve**, e sem o webhook de entrada nós
   não vemos essa mensagem. Usamos o nosso próprio último envio como âncora —
   aproximação que erra para mais.
2. **O que a Meta aceitou e não entregou** conta para ela e não para nós, até o
   webhook existir.
3. **A cota é da conta comercial (WABA)**, não do número. Duas escolas na mesma
   WABA somariam consumo, e cada uma enxerga só o seu.

A tela diz isso com todas as letras e manda conferir no Gerenciador da Meta.
Painel que se apresenta como fatura e não é vira discussão com a direção sobre
um valor que nunca foi nosso.

### O bloqueio

Esgotada a cota, o sistema recusa **abrir conversa nova** — e só isso. Quem
pega carona numa janela já aberta continua passando: bloqueá-lo cortaria a
conversa pela metade, com a família perguntando e a escola muda, sem economizar
um centavo.

Ligado por padrão, e é a escolha conservadora de propósito: a conta é da
escola, e quem descobre o estouro na fatura descobre tarde. Desligar é decisão
consciente da direção, que é diferente de passar do teto sem perceber.

O teto fica em `billing.ts` como constante, com uma coluna por conta para quem
tiver contrato diferente. Vazia, a coluna significa "use o padrão" — e o dia em
que a Meta mudar o número é uma linha aqui, não uma migração de dado.

### O mês é o da Meta

`inicioDoMesDeCobranca` usa **UTC**, e é a exceção declarada ao `toSchoolDate`
de `dates.ts`: lá o assunto é dia letivo, que é civil e local; aqui é mês de
fornecedor. Usar o fuso da escola faria o painel virar três horas depois da
fatura — e, nessas três horas, mostrar zero restante com a cota nova já
valendo.

### `[A VALIDAR]` o que ainda não está na conta

- **Modelo de utilidade dentro de janela aberta** a Meta não cobra desde o fim
  de 2024. Aqui todo modelo é contado como cobrado, o que erra para o lado
  seguro — mostra um custo maior que o real. Acertar depende de saber se a
  janela estava aberta, que é o webhook.
- **Preço por conversa** não aparece em lugar nenhum: ele varia por país e por
  categoria, e um valor em reais escrito no código estaria errado em algum mês.
  O painel conta unidades; a moeda fica no Gerenciador.

---

## 13. Riscos

- **Token de acesso expira.** O token do app dura 24h; o permanente vem de
  System User no Business Manager. A tela precisa dizer isso *antes*, porque
  descobrir no dia da apresentação é descobrir tarde. O teste de conexão é o
  que torna isso visível.
- **Aprovação de modelo é lenta e opaca.** Nada no código acelera. O que dá
  para fazer é recusar antes o que a Meta recusaria depois — e é o que
  `template.ts` faz.
- **Custo por conversa.** A Meta cobra por conversa iniciada. Um disparo para
  a escola inteira é dinheiro, e a confirmação explícita de público que
  `communication` já exige (§8.3, regra 5) vale aqui também. Fase 2 — mas o
  contador da §12 já existe, e é ele que a fila de disparo vai consultar antes
  de cada lote.
- **Número banido por denúncia.** Família que marca como spam derruba a
  qualidade da conta. É risco de operação, não de código, e a seção "Número"
  mostra a qualidade que a Meta reporta para a escola ver antes de cair.

---

## 14. Pendências

- `[A VALIDAR]` Professor pode disparar pelo número da escola?
- `[A VALIDAR]` Consentimento: o termo de matrícula cobre "receber avisos por
  WhatsApp"? Enquanto não cobrir, o disparo em massa fica na fase 2 — e a
  pendência é jurídica, não técnica.
- `[A VALIDAR]` Opt-out: a família precisa de um jeito de sair. Botão "Parar"
  no modelo é o caminho da Meta, e depende do webhook de entrada.
- `DECISÃO-JOÃO` Qual API não oficial entra como segundo adaptador, se entrar.
