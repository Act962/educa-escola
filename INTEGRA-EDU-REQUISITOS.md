# Integra Edu — Levantamento Inicial de Requisitos

| Campo | Valor |
| --- | --- |
| Produto | Integra Edu |
| Documento | Levantamento inicial de requisitos / PRD v0 |
| Versão | 0.1 (rascunho para validação) |
| Data | 09/09/2026 |
| Status | Em validação com o negócio |
| Escopo | Produto, funcionalidades, regras de negócio e experiência. **Não** contempla tecnologia, arquitetura técnica, banco de dados ou implementação. |

> **Como ler este documento.** Ele descreve *o que* o sistema deve fazer, nunca *como* será construído.
> Itens marcados como `[INFORMADO]` vieram do briefing; `[INFERIDO]` foram deduzidos do contexto;
> `[RECOMENDAÇÃO]` são propostas do levantamento; `[A VALIDAR]` dependem de decisão do negócio.
> A seção 33 concentra as questões em aberto e a 34 as premissas.

---

## Sumário

1. Visão Geral do Produto
2. Perfis e Papéis de Usuário
3. Estrutura Organizacional
4. Gestão da Instituição
5. Gestão Acadêmica
6. Portal do Professor
7. Portal do Aluno
8. Comunicação
9. Agenda e Calendário
10. Avaliações, Notas e Desempenho
11. Frequência
12. Atividades e Materiais
13. Documentos
14. Financeiro
15. Relatórios e Indicadores
16. Dashboard
17. Notificações e Alertas
18. Permissões e Controle de Acesso
19. Multi-instituição
20. Auditoria e Histórico
21. Busca e Navegação
22. Experiência e Interface
23. Responsividade e Multiplataforma
24. Segurança e Privacidade
25. Estados e Regras de Negócio
26. Automações
27. Requisitos Funcionais
28. Requisitos Não Funcionais
29. Regras de Negócio
30. Fluxos Principais
31. MVP
32. Backlog Inicial
33. Lacunas e Questões em Aberto
34. Premissas

---

# 1. Visão Geral do Produto

## 1.1 O que é o Integra Edu

O **Integra Edu** é uma plataforma multiplataforma de gestão escolar que centraliza, em um único
sistema, as operações **administrativas**, **pedagógicas** e **acadêmicas** de uma instituição de
ensino.

A plataforma se organiza em três vias de utilização, cada uma com uma experiência própria sobre uma
mesma base de dados institucional:

| Via | Quem usa | O que faz |
| --- | --- | --- |
| **Instituição / Gestão** | Diretores, gestores, coordenadores, secretaria, financeiro | Administra a escola de ponta a ponta: pessoas, estrutura acadêmica, calendário, documentos, comunicação, finanças e indicadores |
| **Professor** | Docentes, com vínculo em uma ou mais instituições | Concentra em um só lugar suas turmas, aulas, diários, notas, frequência, atividades e compromissos — mesmo quando lecionam em escolas diferentes |
| **Aluno** | Estudantes matriculados | Acompanha sua vida acadêmica: horários, notas, frequência, atividades, comunicados, calendário, documentos e histórico |

O conceito central é uma experiência **moderna, integrada, organizada e orientada a dados**, que
substitui planilhas, cadernos, grupos de mensagens e sistemas isolados por um fluxo único e
rastreável.

## 1.2 Problema que resolve

**Dores da instituição**

- Informação acadêmica espalhada entre planilhas, papéis, sistemas legados e conversas informais.
- Retrabalho da secretaria: o mesmo dado é digitado várias vezes em lugares diferentes.
- Falta de visão consolidada — a gestão não sabe, em tempo real, quantos alunos estão em risco de
  reprovação, evasão ou inadimplência.
- Fechamento de período lento e sujeito a erro manual (médias, faltas, boletins, atas).
- Comunicação com famílias e docentes sem rastreabilidade (quem recebeu, quem leu, quando).
- Emissão de documentos (declarações, históricos, boletins) demorada e artesanal.
- Dificuldade de comprovar quem alterou o quê — ausência de trilha de auditoria.

**Dores do professor**

- Tempo excessivo em tarefas administrativas: chamada em papel, transcrição de notas, cálculo de
  médias.
- Quem leciona em mais de uma escola precisa usar sistemas diferentes, com logins e lógicas
  distintas, e não consegue ver a própria agenda inteira.
- Falta de visibilidade sobre o desempenho da turma sem montar planilha à mão.

**Dores do aluno (e do responsável)**

- Não sabe suas notas parciais, faltas acumuladas nem prazos até que seja tarde.
- Comunicados se perdem; o histórico do que foi informado não fica acessível.
- Documentos escolares dependem de ir presencialmente à secretaria.

## 1.3 Público-alvo

- **Primário:** instituições de educação básica (Educação Infantil, Ensino Fundamental I e II, Ensino
  Médio), de pequeno e médio porte, públicas ou privadas. `[INFERIDO]`
- **Secundário:** redes com múltiplas unidades/campi sob a mesma mantenedora. `[INFERIDO]`
- **Evolução:** cursos livres, técnicos, pré-vestibulares e ensino superior — que exigem modelos de
  matrícula por disciplina/crédito e regras de aprovação distintas. `[RECOMENDAÇÃO]`

Usuários finais: gestores, coordenadores, secretaria, financeiro, professores, alunos e — em fase
posterior — responsáveis.

## 1.4 Objetivos principais

| # | Objetivo | Como se mede |
| --- | --- | --- |
| O1 | Centralizar a operação escolar em um único sistema | % de processos-chave executados na plataforma |
| O2 | Reduzir o tempo administrativo do professor | Tempo médio para registrar chamada e fechar notas de uma turma |
| O3 | Dar à gestão visão em tempo real da instituição | Tempo entre o fato e sua visibilidade no dashboard |
| O4 | Tornar a vida acadêmica transparente para o aluno | % de alunos ativos por semana no portal |
| O5 | Atender professores multi-instituição sem fricção | Nº de trocas de contexto por sessão; adoção por docentes com 2+ vínculos |
| O6 | Garantir rastreabilidade e conformidade | Cobertura de auditoria sobre operações sensíveis |
| O7 | Reduzir perdas financeiras por inadimplência não acompanhada | Prazo médio de identificação de inadimplência |

## 1.5 Diferenciais do produto

1. **Identidade única, múltiplos vínculos.** Uma pessoa, uma conta. Professor, aluno ou funcionário
   pode ter vínculos com várias instituições e alternar contexto sem trocar de login. `[INFORMADO]`
2. **Portal do professor consolidado.** Agenda, pendências e turmas de todas as escolas do docente
   em uma visão única, com os dados de cada escola isolados entre si.
3. **Orientação a dados por padrão.** Indicadores pedagógicos e administrativos não são um módulo à
   parte: aparecem no fluxo (dashboard, listas, alertas).
4. **Experiência por perfil com identidade visual comum.** Mesma linguagem visual, jornadas
   diferentes.
5. **Rastreabilidade nativa.** Alterações em notas, frequência, matrículas e permissões são
   auditadas por padrão.
6. **Privacidade e isolamento como requisito de produto**, não como configuração opcional.
7. **Automação de tarefas repetitivas** — alertas de faltas, lembretes de prazo, geração de
   documentos e fechamento de período assistido.

## 1.6 Princípios que devem orientar o sistema

| Princípio | Significado prático |
| --- | --- |
| **Fonte única da verdade** | Cada informação é cadastrada uma vez e reaproveitada em todos os módulos. Nota lançada no diário é a mesma do boletim, do histórico e do indicador. |
| **Contexto explícito** | O usuário sempre sabe em qual instituição, unidade, ano letivo e período está atuando. |
| **Menor privilégio** | Cada perfil vê e faz apenas o necessário à sua função, no escopo do seu vínculo. |
| **Nada se perde** | Operações relevantes são versionadas/auditadas; dados acadêmicos não são apagados, são encerrados ou arquivados. |
| **Erro reversível** | Ações destrutivas exigem confirmação; sempre que possível há desfazer, rascunho e revisão antes de efetivar. |
| **Simplicidade sobre densidade** | Muita informação disponível, pouca informação exibida de uma vez. |
| **Consistência entre perfis** | O mesmo conceito tem o mesmo nome, ícone e comportamento nas três vias. |
| **Acessível a todos** | O produto atende usuários com diferentes níveis de familiaridade digital e necessidades de acessibilidade. |
| **Privacidade desde o desenho** | Dado pessoal só é coletado com finalidade declarada e acesso justificado. |

## 1.7 Visão de longo prazo

O Integra Edu evolui de sistema de registro para **plataforma de gestão educacional**:

- **Curto prazo:** substituir o registro manual — matrícula, diário, notas, frequência, comunicação
  e documentos.
- **Médio prazo:** portal do responsável, financeiro completo, atividades e materiais, relatórios
  gerenciais e integrações (censo escolar, emissão fiscal, meios de pagamento).
- **Longo prazo:** inteligência pedagógica — predição de risco de reprovação e evasão, recomendação
  de intervenções, trilhas de recuperação, comparativos entre unidades da rede, marketplace de
  conteúdos e app dedicado com uso offline parcial. `[RECOMENDAÇÃO]`

---

# 2. Perfis e Papéis de Usuário

## 2.1 Conceitos de identidade

Três conceitos são distintos e não devem ser confundidos:

- **Pessoa/Usuário** — a identidade única de um ser humano na plataforma (e-mail/credencial, dados
  pessoais, preferências). Existe acima das instituições.
- **Vínculo** — a relação entre uma pessoa e uma instituição (e opcionalmente uma unidade), com
  período de validade e situação.
- **Papel** — o conjunto de permissões atribuído a um vínculo. Uma mesma pessoa pode ter papéis
  diferentes em instituições diferentes, e mais de um papel na mesma instituição.

> Exemplo: Ana é **coordenadora** na Escola A, **professora** na Escola B e **responsável** por um
> aluno da Escola C. Uma conta, três vínculos, três conjuntos de permissões independentes.

## 2.2 Perfis da Instituição

### 2.2.1 Administrador da Instituição

- **Objetivo:** configurar e manter a instituição na plataforma.
- **Permissões:** total sobre a instituição — configurações, unidades, usuários, papéis, permissões,
  anos e períodos letivos, integrações, dados e relatórios.
- **Visualiza:** todos os dados da sua instituição, incluindo trilha de auditoria.
- **Ações:** criar/editar unidades; convidar e inativar usuários; criar papéis customizados;
  configurar modelo de avaliação e frequência; abrir e encerrar ano letivo; exportar dados;
  responder a solicitações de titulares de dados (LGPD).
- **Restrições:** não acessa dados de outras instituições; ações destrutivas (encerrar ano letivo,
  excluir instituição, alterar nota fechada) exigem confirmação reforçada e são auditadas.

### 2.2.2 Diretor

- **Objetivo:** acompanhar a instituição de forma estratégica e responder por ela.
- **Permissões:** leitura ampla; aprovação de exceções (alteração de nota fechada, abono de falta em
  lote, cancelamento de matrícula); emissão de documentos oficiais; gestão de comunicados
  institucionais.
- **Visualiza:** dashboards executivos, relatórios, indicadores acadêmicos e financeiros, dados de
  alunos, professores e turmas.
- **Ações:** aprovar/rejeitar solicitações; publicar comunicados institucionais; assinar documentos;
  homologar resultados do conselho de classe.
- **Restrições:** por padrão não altera configurações estruturais nem permissões (delegado ao
  Administrador). `[A VALIDAR]`

### 2.2.3 Coordenador Pedagógico

- **Objetivo:** garantir a qualidade e a regularidade do processo pedagógico.
- **Permissões:** gestão de turmas, disciplinas, grade curricular, horários, alocação de professores;
  acompanhamento de diários, notas e frequência; condução do conselho de classe.
- **Visualiza:** desempenho por turma, disciplina, professor e aluno; pendências dos docentes;
  alertas pedagógicos.
- **Ações:** criar turmas; vincular professores; cobrar pendências; abrir recuperação; registrar
  ocorrências pedagógicas; solicitar alteração de nota fechada.
- **Restrições:** escopo limitado às unidades/segmentos sob sua coordenação; não acessa financeiro
  por padrão.

### 2.2.4 Secretário / Secretaria Escolar

- **Objetivo:** manter a vida escolar formal em ordem.
- **Permissões:** cadastro e manutenção de alunos, responsáveis e matrículas; transferências;
  emissão de documentos; controle de documentação obrigatória.
- **Visualiza:** dados cadastrais e acadêmicos dos alunos, histórico escolar, situação de matrícula
  e de documentos.
- **Ações:** matricular, rematricular, transferir, cancelar matrícula; emitir declarações, boletins,
  históricos; anexar documentos; corrigir dados cadastrais.
- **Restrições:** não lança notas nem frequência (salvo permissão explícita de correção
  administrativa, sempre auditada); não acessa financeiro por padrão.

### 2.2.5 Responsável Financeiro (perfil administrativo)

- **Objetivo:** administrar receitas, cobranças e inadimplência.
- **Permissões:** planos de pagamento, mensalidades, descontos, bolsas, negociações, baixas,
  relatórios financeiros.
- **Visualiza:** dados financeiros dos alunos e da instituição; dados cadastrais mínimos necessários
  à cobrança.
- **Ações:** gerar cobranças; registrar pagamentos; conceder desconto/bolsa dentro de alçada;
  negociar débitos; emitir relatórios e comprovantes.
- **Restrições:** não acessa notas, frequência nem conteúdo pedagógico. Bloqueios por inadimplência
  seguem política institucional e nunca ocultam dados acadêmicos obrigatórios por lei. `[A VALIDAR]`

### 2.2.6 Professor (visto de dentro da instituição)

- **Objetivo:** conduzir suas aulas e registrar o processo pedagógico.
- **Permissões:** apenas turmas e disciplinas às quais está vinculado.
- **Visualiza:** seus alunos, diários, notas, frequência, atividades, materiais, agenda e
  comunicados direcionados a ele.
- **Ações:** registrar frequência e conteúdo; criar avaliações e atividades; lançar e corrigir notas
  dentro do prazo; publicar materiais; comunicar-se com turma e alunos; registrar ocorrências.
- **Restrições:** não vê dados financeiros; não vê turmas de outros professores; não altera nota
  após o fechamento sem aprovação; não acessa dados de outra instituição.

### 2.2.7 Funcionário / Colaborador (perfil genérico)

- **Objetivo:** cobrir funções operacionais (portaria, biblioteca, laboratório, apoio, inspetoria).
- **Permissões:** mínimas e configuráveis por papel customizado.
- **Visualiza:** apenas o que o papel autorizar (por exemplo, lista de presença do dia).
- **Restrições:** sem acesso a notas, financeiro ou dados sensíveis, salvo autorização explícita.

### 2.2.8 Perfis adicionais recomendados `[RECOMENDAÇÃO]`

| Perfil | Justificativa |
| --- | --- |
| **Mantenedora / Rede** | Enxerga várias instituições da mesma rede, de forma consolidada e somente-leitura, para comparação entre unidades. Necessário assim que houver rede multi-unidade. |
| **Auxiliar de sala / Segundo professor** | Comum na Educação Infantil e na educação inclusiva; precisa registrar frequência e observações, sem lançar notas. |
| **Orientador educacional / Psicopedagogo** | Acessa ocorrências, acompanhamento individual e planos de intervenção, com sigilo reforçado. |
| **Suporte da plataforma (operador Integra Edu)** | Acesso técnico excepcional, temporário, justificado e integralmente auditado, sem leitura de dados sensíveis por padrão. Obrigatório para operação responsável. |
| **Aluno representante / Monitor** | Papel opcional com permissões pontuais (ex.: registrar presença em atividade extraclasse). Baixa prioridade. |

## 2.3 Perfil Professor (via própria)

O professor é ao mesmo tempo um papel dentro da instituição e uma **via de utilização própria**, com
visão consolidada acima das escolas.

| Cenário | Requisito decorrente |
| --- | --- |
| Uma única instituição | A troca de contexto deve ser invisível: entra direto no contexto único. |
| Várias instituições | Precisa de visão agregada (agenda, pendências) **e** de contexto isolado por escola. Nenhum dado pode vazar entre escolas. |
| Várias disciplinas | Navegação por disciplina dentro da mesma turma; lançamentos independentes por disciplina. |
| Várias turmas | Listas, filtros e atalhos para alternar rapidamente entre turmas; ações em lote quando o contexto permitir. |
| Substituto / temporário | Vínculo com data de início e fim; acesso encerra automaticamente ao fim do vínculo, preservando o histórico do que registrou. |
| Professor que também é responsável ou aluno | Papéis coexistem na mesma conta, com separação clara de contexto. |

- **Objetivo:** reduzir carga administrativa e acompanhar melhor os alunos.
- **Restrições:** só vê o que pertence aos seus vínculos ativos; dados de vínculos encerrados ficam
  disponíveis apenas em modo histórico e somente-leitura, se a instituição permitir. `[A VALIDAR]`

## 2.4 Perfil Aluno

- **Objetivo:** acompanhar com clareza sua vida acadêmica atual e histórica.
- **Permissões:** somente-leitura sobre seus próprios dados, exceto onde a interação é prevista
  (entregar atividade, confirmar leitura de comunicado, solicitar documento, atualizar contato).
- **Visualiza:** matrícula, turmas, disciplinas, grade horária, notas, frequência, atividades,
  avaliações, materiais, comunicados, calendário, documentos, histórico e pendências.
- **Ações:** entregar atividades; consultar e baixar documentos; solicitar declarações; confirmar
  leitura; comunicar-se com professores conforme a política da escola.
- **Restrições:** nunca vê dados de outro aluno (inclusive em rankings, que devem ser anônimos ou
  desativados); não vê observações internas/pedagógicas restritas; não altera nota, frequência nem
  dados acadêmicos.

| Situação | Requisito decorrente |
| --- | --- |
| Aluno matriculado | Acesso pleno ao contexto da matrícula ativa. |
| Aluno com múltiplas turmas | Suporta matrícula em turma principal + turmas complementares (eletivas, reforço, itinerários). |
| Aluno transferido | Perde acesso ao contexto ativo da escola de origem; mantém acesso ao histórico e documentos emitidos, conforme política. `[A VALIDAR]` |
| Aluno com histórico | Consulta anos letivos anteriores em modo somente-leitura. |
| Aluno em mais de uma instituição | Mesma conta, contexto alternável (ex.: escola regular + curso técnico). |
| Aluno menor de idade | Comunicação e certos dados podem exigir o responsável; consentimentos são do responsável (LGPD, art. 14). |
| Aluno concluinte / egresso | Acesso reduzido, apenas histórico e documentos, por período definido pela instituição. `[A VALIDAR]` |

## 2.5 Perfil Responsável — avaliação `[RECOMENDAÇÃO]`

**Recomendação: sim, o produto deve ter um perfil de responsável, mas como evolução pós-MVP.**

Justificativa:

1. Na educação básica, o responsável é o destinatário legal da comunicação e o pagador — sem ele o
   módulo financeiro e boa parte da comunicação ficam incompletos.
2. Para alunos menores, o tratamento de dados se apoia no consentimento do responsável (LGPD).
3. É o principal driver de percepção de valor pelas famílias e, portanto, de retenção da escola.

Porém, no MVP, o vínculo responsável↔aluno deve existir **como dado cadastral** (nome, documento,
contato, grau de parentesco, responsabilidade legal/financeira), mesmo sem portal próprio, porque
matrícula, contrato e cobrança dependem dele.

**Funcionalidades previstas do portal do responsável (pós-MVP):**

- Visão consolidada de todos os seus dependentes, inclusive em instituições diferentes.
- Notas, frequência, boletim e comunicados de cada dependente.
- Agenda, calendário e prazos.
- Confirmação de leitura de comunicados e autorizações (saída, passeio, uso de imagem).
- Justificativa de falta com anexo.
- Área financeira: faturas, segunda via, comprovantes, negociação.
- Solicitação de documentos e acompanhamento do pedido.
- Canal de mensagens com secretaria/coordenação (e com professores, se a escola permitir).
- Rematrícula online.

**Restrições:** vê apenas os dependentes aos quais está vinculado; responsáveis não-financeiros não
veem dados financeiros; em caso de guarda compartilhada ou restrição judicial, o acesso é
configurável por dependente. `[A VALIDAR]`

## 2.6 Matriz resumida de perfis

| Perfil | Escopo | Cadastros | Acadêmico | Notas/Freq. | Financeiro | Comunicação | Config. | Auditoria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Administrador | Instituição | Total | Total | Ler/Corrigir | Config. | Total | Total | Ler |
| Diretor | Instituição | Ler | Ler/Aprovar | Aprovar exceção | Ler | Institucional | — | Ler |
| Coordenador | Unidade/segmento | Ler/Editar | Total | Ler/Solicitar ajuste | — | Turma/segmento | — | Ler (escopo) |
| Secretaria | Instituição | Total (aluno) | Matrículas | Correção auditada | — | Institucional/individual | — | — |
| Financeiro | Instituição | Ler mínimo | — | — | Total | Financeira | — | — |
| Professor | Suas turmas | — | Suas turmas | Lançar/Editar (prazo) | — | Suas turmas | — | — |
| Funcionário | Configurável | Configurável | — | — | — | — | — | — |
| Aluno | Ele mesmo | Contato próprio | Ler | Ler | Ler (se maior) | Receber/Responder | — | — |
| Responsável* | Dependentes | Contato | Ler | Ler | Ler/Pagar | Receber/Responder | — | — |

\* pós-MVP.

---

# 3. Estrutura Organizacional

## 3.1 Entidades estruturais

| Entidade | Definição | Observações |
| --- | --- | --- |
| **Instituição** | Raiz de tudo. Representa a escola/mantenedora contratante. É a fronteira de isolamento de dados. | Toda informação de domínio pertence a exatamente uma instituição. |
| **Unidade / Campus** | Subdivisão física ou administrativa da instituição. | Toda instituição tem ao menos uma unidade (criada implicitamente). Permissões podem ser restritas por unidade. |
| **Ano Letivo** | Ciclo anual de funcionamento (ex.: 2027). Define vigência de turmas, matrículas, calendário e regras de avaliação. | Só um ano letivo é "corrente" por unidade, mas outros podem estar abertos (planejamento do ano seguinte, encerramento do anterior). |
| **Período Letivo** | Recorte do ano letivo (bimestre, trimestre, semestre, etapa). | Quantidade, nomes e pesos são configuráveis por instituição/segmento. |
| **Nível de Ensino / Segmento** | Educação Infantil, Fundamental I, Fundamental II, Médio, Técnico, EJA, Curso Livre. | Determina regras de avaliação, frequência e documentos. |
| **Curso / Programa** | Trilha formativa (ex.: Ensino Médio Técnico em Informática). Em educação básica pode ser implícito. | Necessário para instituições com oferta diversificada. |
| **Série / Ano Escolar** | Etapa dentro do segmento (6º ano, 1ª série do EM). | Base da progressão do aluno. |
| **Turma** | Agrupamento concreto de alunos, em um ano letivo, série, turno e unidade. | Unidade operacional central: aulas, diários, notas e frequência penduram nela. |
| **Turno** | Manhã, Tarde, Noite, Integral. | Afeta grade horária e capacidade de salas. |
| **Componente Curricular / Disciplina** | Matéria (Matemática, História, Projeto de Vida). | Catálogo por instituição; instanciada por turma. |
| **Grade Curricular / Matriz** | Conjunto de disciplinas e cargas horárias de uma série/curso em um ano letivo. | Origem das disciplinas das turmas. |
| **Oferta de Disciplina (Turma-Disciplina)** | A disciplina X, na turma Y, com o(s) professor(es) Z. | É onde o professor é efetivamente alocado. |
| **Aula** | Ocorrência de uma oferta em uma data e horário. | Base do diário de classe e da frequência. |
| **Horário / Grade de Horários** | Distribuição semanal das aulas por turma, professor e sala. | Precisa detectar conflitos. |
| **Sala / Ambiente** | Espaço físico com capacidade e recursos. | Opcional no MVP; necessário para grade e reservas. |
| **Professor** | Pessoa com vínculo docente na instituição. | Alocado em ofertas de disciplina. |
| **Aluno** | Pessoa com matrícula na instituição. | Vinculado a turmas por meio da matrícula. |
| **Responsável** | Pessoa vinculada a um aluno. | Grau de parentesco, responsabilidade legal e/ou financeira. |
| **Calendário Acadêmico** | Conjunto de dias letivos, feriados, recessos e eventos do ano letivo. | Pode ser da instituição, da unidade ou específico de um segmento/turma. |
| **Matrícula** | Vínculo formal do aluno com uma turma/série em um ano letivo. | Entidade com ciclo de vida próprio (ver seção 25). |

## 3.2 Relações principais

```
Instituição
 └── Unidade (1..N)
      └── Ano Letivo (1..N)
           ├── Calendário Acadêmico (1)
           ├── Período Letivo (1..N)
           └── Turma (0..N)  ──> Série, Turno, Curso, Sala (opcional)
                ├── Oferta de Disciplina (1..N) ──> Disciplina + Professor(es)
                │     ├── Aula (0..N) ──> Frequência, Conteúdo
                │     ├── Avaliação (0..N) ──> Nota por aluno
                │     └── Atividade (0..N) ──> Entrega por aluno
                └── Matrícula (0..N) ──> Aluno ──> Responsável (0..N)
```

## 3.3 Regras estruturais

1. Toda entidade de domínio pertence a **uma** instituição; não existe entidade compartilhada entre
   instituições, exceto a identidade da pessoa.
2. Uma turma pertence a exatamente um ano letivo, uma unidade, uma série e um turno.
3. Uma matrícula ativa vincula um aluno a uma turma dentro de um ano letivo. O aluno pode ter apenas
   **uma matrícula principal ativa por ano letivo na mesma instituição**; matrículas complementares
   (eletivas, reforço, dependência) são permitidas e marcadas como tal. `[A VALIDAR]`
4. Uma oferta de disciplina precisa de ao menos um professor responsável para permitir lançamentos;
   pode ter professores auxiliares.
5. Um professor pode estar em várias ofertas, turmas, turnos e unidades, respeitando conflito de
   horário e carga máxima configurada.
6. A grade curricular define as disciplinas obrigatórias de uma série; a turma herda a grade ao ser
   criada e pode ser ajustada com registro do desvio.
7. O calendário determina os dias letivos; nenhuma aula pode ser registrada fora de dia letivo sem
   marcação de exceção (aula extra/reposição) e justificativa.
8. Períodos letivos não se sobrepõem dentro do mesmo ano letivo e cobrem integralmente o ano.
9. Encerrar um ano letivo congela turmas, matrículas, diários e notas para edição comum; alterações
   posteriores exigem permissão especial e são auditadas.
10. Excluir estruturas com dependências (turma com matrícula, disciplina com notas) é proibido — o
    caminho é **cancelar/encerrar/arquivar**.
11. Alterar a série, o turno ou a unidade de uma turma em andamento exige confirmação e propaga
    efeitos para horários, ofertas e matrículas.
12. Salas têm capacidade; alocar turma acima da capacidade gera alerta, não bloqueio. `[A VALIDAR]`

---

# 4. Gestão da Instituição

## 4.1 Cadastro da instituição

**Dados institucionais:** razão social, nome fantasia, CNPJ, código INEP/MEC, tipo (pública
municipal/estadual/federal, privada, filantrópica), níveis de ensino ofertados, ato de autorização e
credenciamento, mantenedora.

**Contato:** telefones, e-mails (geral, secretaria, financeiro), site, redes sociais, responsável
legal, responsável pedagógico.

**Endereço:** por instituição e por unidade (CEP, logradouro, número, complemento, bairro, cidade,
UF, país, coordenadas opcionais).

**Identidade visual:** logotipo (versões clara/escura), cor de destaque, papel timbrado para
documentos, assinatura digitalizada dos responsáveis (uso controlado). Aplica-se a documentos,
comunicados e ao cabeçalho dos portais.

**Configurações gerais:**

- Fuso horário, idioma e formato de data/número.
- Ano letivo corrente e períodos letivos.
- Modelo de avaliação padrão (numérico, conceitual, parecer descritivo, misto).
- Média para aprovação, nota mínima para recuperação, frequência mínima.
- Política de fechamento e prazos de lançamento.
- Regras de justificativa e abono de faltas.
- Política de comunicação (quem pode falar com quem).
- Política de visibilidade de notas parciais para aluno/responsável.
- Numeração e modelos de documentos.
- Preferências de notificação institucional.

**Unidades:** nome, código, endereço, turnos, capacidade, calendário próprio (opcional), gestor
responsável, situação (ativa/inativa).

**Informações acadêmicas:** segmentos e cursos ofertados, séries por segmento, grade curricular por
série/ano, catálogo de disciplinas, carga horária mínima anual, dias letivos mínimos.

## 4.2 Gestão de usuários

| Funcionalidade | Descrição |
| --- | --- |
| **Criação/Convite** | Usuário é convidado por e-mail (ou criado com credencial provisória) para um papel e escopo específicos. O convite tem validade, pode ser reenviado e revogado. |
| **Aceite e vínculo** | Se a pessoa já tem conta, o convite apenas acrescenta um vínculo; não cria conta duplicada. |
| **Ativação/Inativação** | Vínculo pode ser suspenso ou encerrado sem apagar o histórico. Inativar remove o acesso imediatamente e encerra sessões ativas. |
| **Papéis** | Papéis pré-definidos (Administrador, Diretor, Coordenador, Secretaria, Financeiro, Professor, Funcionário) e papéis customizados por instituição. |
| **Permissões** | Conjunto de permissões granulares por recurso e ação, com escopo (instituição, unidade, turma, disciplina). |
| **Múltiplos papéis** | A mesma pessoa pode acumular papéis na mesma instituição; permissões são a união dos papéis. |
| **Controle de acesso** | Registro de último acesso, sessões ativas, encerramento remoto de sessão, exigência de redefinição de senha. |
| **Delegação temporária** | Substituição temporária (ex.: coordenador de férias) com data de início/fim. `[RECOMENDAÇÃO]` |
| **Importação em lote** | Importar usuários por planilha, com validação prévia, pré-visualização e relatório de erros. |

## 4.3 Gestão de professores

- **Cadastro:** dados pessoais (nome, nome social, documento, nascimento, contato, endereço), foto.
- **Dados profissionais:** formação, titulação, área de atuação, registro profissional, matrícula
  funcional, regime de contratação, carga horária contratada, data de admissão/desligamento.
- **Disciplinas habilitadas:** o que o professor pode lecionar (usado para sugerir alocações e
  alertar sobre incompatibilidade).
- **Turmas e ofertas:** alocação por ano letivo, com histórico.
- **Horários:** grade individual consolidada, com detecção de conflito entre turmas — e alerta
  informativo quando o conflito ocorre entre instituições diferentes do mesmo docente. `[RECOMENDAÇÃO]`
- **Vínculo com instituições:** situação, período, papel, unidades de atuação.
- **Histórico:** turmas lecionadas, cargas horárias, ocorrências, avaliações internas (se houver),
  registros de pendências de lançamento.
- **Substituições:** registro de professor substituto por período, com acesso temporário à oferta.

## 4.4 Gestão de alunos

- **Cadastro:** nome completo, nome social, data de nascimento, sexo/gênero, nacionalidade,
  naturalidade, documentos (CPF, RG, certidão, NIS, código INEP do aluno), foto, endereço, contatos.
- **Dados complementares:** necessidades educacionais específicas e laudos, restrições alimentares e
  de saúde, medicações, alergias, plano de saúde, autorização de uso de imagem, autorização de saída,
  pessoas autorizadas a buscar, transporte escolar, uso de bolsa/benefício. *(Dados sensíveis — ver
  seção 24.)*
- **Dados acadêmicos:** escola de origem, série de ingresso, histórico anterior, situação atual,
  progressão, dependências.
- **Responsáveis:** vínculo com grau de parentesco, indicação de responsável legal, financeiro e de
  contato prioritário; restrições de contato.
- **Matrículas:** histórico completo por ano letivo, com situação, turma, turno e datas.
- **Turmas:** turma principal e complementares.
- **Histórico escolar:** notas e frequência por ano/série/disciplina, resultado final, incluindo
  períodos anteriores importados.
- **Situação acadêmica:** ativo, transferido, concluinte, evadido, trancado, etc. (seção 25).
- **Ocorrências:** registros disciplinares e pedagógicos, com nível de sigilo e autor.
- **Documentos:** anexos obrigatórios e opcionais, com checklist de pendências documentais.
- **Importação em lote:** migração inicial de alunos e matrículas com validação e relatório.

---

# 5. Gestão Acadêmica

## 5.1 Matrícula

**Descrição.** Formaliza o vínculo do aluno com uma turma/série em um ano letivo.

**Fluxo principal**

1. Secretaria inicia a matrícula escolhendo ano letivo, unidade, segmento, série e turno.
2. Localiza a pessoa (aluno existente) ou cadastra um novo aluno.
3. Registra/atualiza responsáveis.
4. Anexa a documentação exigida (checklist configurável).
5. Seleciona a turma disponível (respeitando vagas) ou deixa "a definir".
6. Define condições financeiras, quando o módulo financeiro estiver ativo (plano, descontos, bolsa).
7. Confirma: a matrícula passa a **Ativa**, o aluno passa a constar nos diários e recebe acesso ao
   portal.

**Fluxos alternativos**

- **Pré-matrícula:** registro de intenção, sem vaga garantida; expira se não confirmada no prazo.
- **Lista de espera:** quando não há vaga; ao abrir vaga, gera alerta para a secretaria.
- **Matrícula com pendência documental:** permitida se a instituição autorizar, com prazo e alerta.
- **Matrícula fora do prazo / transferência recebida:** exige aproveitamento de notas e faltas do
  período já decorrido.
- **Matrícula em turma cheia:** exige aprovação de gestor.

**Regras**

- Não permitir duas matrículas principais ativas do mesmo aluno no mesmo ano letivo e instituição.
- A turma deve pertencer ao ano letivo, série, turno e unidade escolhidos.
- Alterar a turma de um aluno com lançamentos exige transferência interna (5.4), não edição direta.
- Matrícula gera cobrança quando o financeiro está ativo.

**Resultado esperado.** Aluno matriculado, presente nos diários, com acesso ao portal e situação
acadêmica coerente.

## 5.2 Rematrícula

- Processo em lote no fim do ano letivo: o sistema propõe a progressão de cada aluno com base no
  resultado final (aprovado → série seguinte; reprovado → mesma série).
- Gera pendências de confirmação para a secretaria e, quando houver portal do responsável,
  confirmação online. `[RECOMENDAÇÃO]`
- Permite bloqueio por pendência documental ou financeira, conforme política. `[A VALIDAR]`
- Alunos não rematriculados até a data-limite entram em situação "Não rematriculado" e alimentam o
  indicador de evasão.

## 5.3 Transferência (saída)

1. Secretaria registra a solicitação, o motivo e a data de desligamento.
2. Sistema apura notas e frequência até a data e gera a **Guia/Declaração de Transferência** e o
   **Histórico Escolar parcial**.
3. Matrícula passa a **Transferida**; aluno sai dos diários a partir da data, preservando os
   registros anteriores.
4. Acesso do aluno ao contexto ativo é encerrado; o histórico permanece conforme política.
5. Cobranças futuras são canceladas e as vencidas seguem a regra da instituição. `[A VALIDAR]`

## 5.4 Transferência interna (troca de turma)

- Mantém a matrícula; troca a turma a partir de uma data de efeito.
- Notas e faltas do período anterior são preservadas e transportadas quando as disciplinas
  coincidem; divergências de grade geram pendência de análise da coordenação.
- Operação auditada, com histórico de turmas do aluno.

## 5.5 Turmas

- Criação a partir de ano letivo, unidade, série, turno, capacidade e sala.
- Herda a grade curricular da série; disciplinas podem ser ajustadas com justificativa.
- Alocação de professores por disciplina.
- Definição de horário semanal.
- Ações: duplicar turma (para o ano seguinte ou turma paralela), listar alunos, ver desempenho,
  encerrar.
- Estados conforme seção 25.

## 5.6 Disciplinas e grade curricular

- **Catálogo de disciplinas** por instituição: nome, sigla, área do conhecimento, tipo (obrigatória,
  eletiva, complementar), se compõe média, se controla frequência.
- **Grade curricular** por série/curso/ano letivo: disciplinas, carga horária semanal e anual,
  pré-requisitos (quando aplicável).
- Alteração de grade em ano letivo em andamento exige permissão especial e não afeta lançamentos já
  realizados.

## 5.7 Calendário acadêmico

- Definição de início e fim do ano letivo, períodos letivos, feriados, recessos, dias letivos,
  eventos, conselhos de classe, semanas de prova, reuniões.
- Cálculo automático de dias letivos por turma/segmento e alerta quando abaixo do mínimo legal.
- Reposição de aula: registro de aula fora do dia letivo padrão, com justificativa.
- Calendário pode ser da instituição, da unidade, do segmento ou da turma; o mais específico
  prevalece, acumulando os eventos herdados.

## 5.8 Horários

- Montagem da grade semanal por turma, com aulas por disciplina, professor, sala e horário.
- Detecção de conflitos: professor em duas turmas no mesmo horário; sala ocupada; turma com duas
  aulas simultâneas; carga horária acima do contratado.
- Alterações pontuais (aula extra, cancelamento, troca de professor, mudança de sala) geram
  notificação aos afetados.
- Publicação da grade para professores e alunos.

## 5.9 Diário de classe

- Lista de aulas previstas por oferta de disciplina, geradas a partir do horário e do calendário.
- Em cada aula: data, horário, conteúdo ministrado, metodologia/observações, frequência dos alunos,
  ocorrências, anexos e tarefas de casa.
- Estados da aula: **Prevista → Registrada → Fechada**; aula pode ser **Cancelada** ou marcada como
  **Não ocorrida** com motivo.
- Indicador de aulas pendentes de registro por professor, com alerta à coordenação.
- Registro em lote (marcar todos presentes e apontar exceções) para reduzir tempo de chamada.

## 5.10 Avaliações, notas e recuperação

Detalhado na seção 10. Em resumo: avaliações por período e disciplina, com peso; lançamento por
professor; consolidação em média do período; recuperação paralela e/ou final; fechamento do período
com validação de pendências.

## 5.11 Frequência

Detalhado na seção 11.

## 5.12 Atividades e trabalhos

Detalhado na seção 12.

## 5.13 Conselho de classe

- Agendamento por turma e período letivo, integrado ao calendário.
- Painel com o retrato da turma: notas, frequência, ocorrências, alunos em risco.
- Registro de parecer por aluno e por turma; encaminhamentos e responsáveis.
- Decisões possíveis: aprovado, aprovado pelo conselho, reprovado, em recuperação, encaminhamento
  pedagógico.
- Aprovação pelo conselho é uma **exceção registrada**: exige justificativa, autor e auditoria.
- Ata do conselho gerada como documento.

## 5.14 Resultado final, aprovação e reprovação

- Ao encerrar o último período, o sistema apura o resultado por disciplina (média + frequência) e o
  resultado geral do aluno.
- Situações: Aprovado; Aprovado com dependência; Reprovado por nota; Reprovado por frequência;
  Reprovado por nota e frequência; Aprovado pelo conselho; Em recuperação final; Não avaliado.
- Regras de dependência/progressão parcial são configuráveis. `[A VALIDAR]`
- O resultado alimenta histórico escolar, rematrícula e indicadores.

## 5.15 Histórico escolar e situação acadêmica

- Consolida, por ano letivo e série, disciplinas, cargas horárias, notas finais, frequência e
  resultado, incluindo períodos cursados em outras instituições (importados manualmente).
- Emite documento formal com identificação da instituição e do responsável pela emissão.
- Situação acadêmica do aluno é derivada da matrícula ativa e do resultado dos anos anteriores.

---

# 6. Portal do Professor

## 6.1 Princípio da experiência

O portal do professor é organizado em torno de **"o que eu preciso fazer agora"**, não de menus
administrativos. Quando o docente tem vínculo com mais de uma instituição, existem dois níveis:

- **Visão consolidada (acima das instituições):** agenda do dia/semana, pendências e notificações de
  todas as escolas, cada item claramente identificado com a instituição de origem.
- **Contexto de instituição:** ao entrar em uma turma ou registro, o professor está dentro de uma
  instituição específica, e apenas os dados dela são acessíveis.

A visão consolidada exibe **apenas metadados operacionais** (escola, turma, disciplina, horário,
tipo de pendência). Nenhum dado de aluno aparece fora do contexto de sua instituição.

## 6.2 Dashboard do professor

- Aulas de hoje, em ordem, com horário, turma, disciplina, sala e instituição.
- Ação rápida: "Fazer chamada" direto do card da aula.
- Pendências agrupadas: chamadas não registradas, notas não lançadas, atividades a corrigir, prazos
  de fechamento se aproximando.
- Próximas avaliações e entregas.
- Comunicados recebidos e não lidos.
- Alunos que exigem atenção (faltas em excesso, queda de desempenho) — respeitando o contexto.
- Resumo da semana: aulas dadas x previstas.

## 6.3 Instituições vinculadas

- Lista de vínculos com situação, unidade(s), papel e período.
- Troca de contexto em um clique, com indicação visual permanente de onde ele está.
- Vínculos encerrados aparecem em "Histórico", em modo somente-leitura, se a instituição permitir.

## 6.4 Turmas e disciplinas

- Lista de turmas por instituição, ano letivo e período, com filtros por turno, série e disciplina.
- Página da turma: alunos, horário, diário, avaliações, atividades, materiais, desempenho,
  frequência e comunicados.
- Ficha do aluno (escopo da turma): notas, faltas, atividades entregues, ocorrências visíveis ao
  professor e observações próprias.

## 6.5 Agenda e calendário

- Visões dia / semana / mês, com todas as instituições sobrepostas e diferenciadas por cor/rótulo.
- Eventos: aulas, provas, entregas, conselhos, reuniões, feriados, recessos, eventos institucionais.
- Detecção de conflito entre compromissos de instituições diferentes, como alerta informativo.
- Exportação/assinatura de calendário para agenda pessoal. `[RECOMENDAÇÃO]`

## 6.6 Diário de classe e frequência

- Chamada otimizada: lista com foto e nome, padrão "todos presentes", marcação por toque, contagem
  em tempo real, salvamento contínuo.
- Registro de conteúdo com sugestão a partir do plano de aula/último registro.
- Registro de aula dupla/geminada em uma operação.
- Reposição e aula extra com justificativa.
- Edição dentro do prazo configurado; depois disso, exige justificativa e gera auditoria.
- Indicação clara de aulas pendentes e do prazo restante.

## 6.7 Notas e avaliações

- Criação de avaliações (tipo, peso, data, valor máximo, período, disciplina, turma).
- Lançamento em grade (tipo planilha) com navegação por teclado, colagem de valores e cálculo
  automático de média parcial.
- Salvamento como **rascunho** e **publicação** (a nota só fica visível ao aluno quando publicada).
- Validação: nota fora do intervalo, aluno sem nota, avaliação sem peso.
- Recuperação: lançamento e recálculo automático conforme a regra da instituição.
- Fechamento do período: checklist de pendências, prévia dos resultados, confirmação e travamento.
- Solicitação de reabertura/alteração após o fechamento, com fluxo de aprovação.

## 6.8 Atividades e materiais

- Criar atividade com enunciado, anexos, prazo, valor, tipo de entrega (online, presencial, sem
  entrega) e destinatários (turma inteira ou alunos específicos).
- Acompanhar entregas: entregues, pendentes, atrasadas.
- Corrigir com nota, feedback textual e anexo de devolutiva; correção em lote quando aplicável.
- Biblioteca de materiais por disciplina/turma, reutilizável entre turmas e anos letivos.
- Banco pessoal de questões/avaliações reutilizáveis. `[RECOMENDAÇÃO — pós-MVP]`

## 6.9 Alunos e desempenho

- Painel da turma: distribuição de notas, média por avaliação, frequência média, alunos abaixo da
  média, evolução entre períodos.
- Comparativo entre turmas do mesmo professor (dentro da mesma instituição).
- Sinalização de alunos em risco, com critérios definidos pela instituição.
- Registro de observações pedagógicas com nível de visibilidade (só professor, coordenação, escola).

## 6.10 Comunicação, pendências e notificações

- Comunicados para a turma e mensagens individuais, conforme a política da escola.
- Recebimento de comunicados da gestão e da coordenação.
- Central de pendências com prazo, prioridade e link direto para a ação.
- Notificações no sistema e por e-mail/push, com preferências por tipo e por instituição.

## 6.11 Redução de carga administrativa

- Ações em lote (marcar presença, publicar notas, replicar conteúdo de aula).
- Reaproveitamento entre turmas: copiar avaliação, atividade, material e plano de aula.
- Preenchimento assistido: sugestão de conteúdo, cálculo automático de médias, alerta de pendência
  antes do prazo.
- Modo offline mínimo para a chamada, com sincronização posterior. `[RECOMENDAÇÃO — pós-MVP]`
- Impressão/exportação de lista de presença e mapa de notas para uso em sala.

---

# 7. Portal do Aluno

## 7.1 Princípio da experiência

O aluno precisa responder rapidamente a quatro perguntas: *o que tenho agora?*, *o que preciso
entregar?*, *como estou indo?* e *o que a escola está me dizendo?*.

## 7.2 Dashboard do aluno

- Próximas aulas do dia com horário, disciplina, professor e sala.
- Próximas avaliações e entregas, ordenadas por proximidade do prazo.
- Últimas notas publicadas.
- Frequência atual, com destaque quando próxima do limite.
- Comunicados não lidos.
- Pendências (documento, entrega, confirmação de leitura, financeiro quando aplicável).
- Eventos próximos do calendário.

## 7.3 Matrícula e dados acadêmicos

- Situação da matrícula, turma, série, turno, unidade e ano letivo.
- Dados cadastrais próprios, com solicitação de correção via secretaria.
- Documentos pendentes de entrega.

## 7.4 Turmas, disciplinas e grade horária

- Disciplinas do período, com professor, carga horária e desempenho resumido.
- Grade horária semanal e visão do dia; alterações de horário destacadas.

## 7.5 Notas, desempenho e boletim

- Notas por disciplina e período, com detalhe das avaliações que compõem a média.
- Situação por disciplina: acima/abaixo da média, em recuperação, aprovado, reprovado.
- Boletim do período e do ano, disponível para consulta e download quando publicado.
- Evolução ao longo dos períodos.
- Sem comparação nominal com colegas; comparativos apenas contra a média da turma, de forma anônima
  e configurável pela instituição. `[A VALIDAR]`

## 7.6 Frequência

- Percentual por disciplina e geral, faltas registradas por data e aula, faltas justificadas.
- Alerta visual ao se aproximar do limite mínimo.
- Envio de justificativa com anexo, quando a instituição permitir. `[A VALIDAR]`

## 7.7 Atividades, avaliações e materiais

- Lista de atividades com prazo, status (pendente, entregue, atrasada, corrigida) e nota.
- Entrega online com anexo, texto e confirmação de recebimento; controle de reenvio até o prazo.
- Feedback do professor e nota da correção.
- Materiais de apoio organizados por disciplina.

## 7.8 Comunicados, agenda e calendário

- Caixa de comunicados com leitura, histórico e confirmação quando exigida.
- Calendário acadêmico com aulas, provas, entregas, eventos, feriados e recessos.

## 7.9 Documentos e histórico

- Documentos disponíveis (boletim, declaração de matrícula, comprovantes) para consulta e download.
- Solicitação de documentos com acompanhamento do status.
- Histórico escolar consolidado e acesso a anos letivos anteriores em modo leitura.

## 7.10 Notificações e pendências

- Central de notificações com filtros e marcação de lida.
- Preferências de canal por tipo de evento.

---

# 8. Comunicação

## 8.1 Tipos de comunicação

| Tipo | Origem | Destino | Característica |
| --- | --- | --- | --- |
| **Comunicado institucional** | Gestão/Diretoria | Toda a instituição, unidade, segmento, série, turma ou perfil | Formal, com histórico, anexos e confirmação de leitura opcional |
| **Aviso de turma** | Professor/Coordenação | Turma ou disciplina | Operacional, ligado a um contexto acadêmico |
| **Mensagem individual** | Qualquer perfil autorizado | Pessoa específica | Conversa, com histórico e rastreabilidade |
| **Notificação automática** | Sistema | Perfis afetados | Gerada por evento (seção 17) |
| **Alerta** | Sistema | Gestão/Coordenação/Professor | Situação que exige ação (faltas, desempenho, pendência) |
| **Circular com anexo** | Gestão | Segmentado | Documento formal (autorização, calendário, regulamento) |

## 8.2 Funcionalidades

- **Composição:** título, corpo formatado, anexos, prioridade, data de publicação e de expiração.
- **Segmentação de destinatários:** por perfil, unidade, segmento, série, turma, disciplina, situação
  (ex.: alunos com pendência documental) ou seleção manual. Pré-visualização do público estimado
  antes do envio.
- **Agendamento de envio** e envio imediato.
- **Confirmação de leitura:** obrigatória ou opcional, com painel de quem leu e quem não leu, e
  possibilidade de reenvio apenas aos não-leitores.
- **Rascunhos e modelos** reutilizáveis.
- **Histórico de comunicações** por instituição, por destinatário e por assunto, com busca.
- **Canais:** dentro da plataforma sempre; e-mail e push conforme preferência e criticidade. `[A VALIDAR: SMS/WhatsApp]`
- **Moderação e política:** a instituição define quem pode enviar para quem (ex.: aluno pode iniciar
  conversa com professor? professor pode falar diretamente com responsável?).
- **Bloqueio de conversa** e registro de denúncia/abuso. `[RECOMENDAÇÃO]`
- **Idioma e acessibilidade:** texto simples, sem depender apenas de cor ou imagem.

## 8.3 Regras

1. Toda comunicação pertence a uma instituição e nunca cruza instituições.
2. Comunicado institucional não pode ser excluído após a leitura; pode ser **retificado** com nova
   versão e aviso, mantendo o histórico.
3. Mensagens entre professor e aluno menor de idade podem exigir cópia ao responsável ou registro
   institucional, conforme política. `[A VALIDAR]`
4. Comunicações são retidas pelo prazo definido pela instituição e constam do histórico do aluno.
5. Envio em massa exige confirmação explícita quando o público estimado ultrapassa um limite.

## 8.4 Comunicações que devem gerar notificação automática

Nota publicada; boletim disponível; nova atividade; prazo próximo (24h/48h); atividade corrigida;
falta registrada; excesso de faltas; alteração de horário ou de sala; cancelamento de aula; novo
comunicado; documento disponível; solicitação atendida; matrícula confirmada/alterada; fechamento de
período próximo (professor); pendência de lançamento (professor); vencimento e atraso financeiro;
convite de acesso; alteração de dados sensíveis da conta.

---

# 9. Agenda e Calendário

## 9.1 Camadas de calendário

1. **Institucional** — feriados nacionais, eventos da escola, recessos.
2. **Unidade** — eventos específicos do campus.
3. **Segmento / série** — semanas de prova, conselhos, atividades por faixa.
4. **Turma** — aulas, avaliações, entregas, saídas.
5. **Pessoal** — compromissos do usuário derivados dos itens acima e, opcionalmente, próprios.

Cada perfil vê a união das camadas que lhe dizem respeito. Nenhum evento aparece fora do escopo de
permissão.

## 9.2 Tipos de evento

Aula; aula extra/reposição; avaliação/prova; entrega de atividade; conselho de classe; reunião
(pedagógica, de pais, administrativa); evento escolar (festa, feira, formatura); feriado; recesso;
férias; período de matrícula/rematrícula; prazo administrativo (fechamento, entrega de documentos);
data financeira (vencimento) — visível apenas a quem tem permissão.

## 9.3 Funcionalidades

- Visões dia, semana, mês, agenda (lista) e linha do tempo do ano letivo.
- Criação de eventos com recorrência, local, responsável, público-alvo e anexos.
- Vinculação automática: criar avaliação gera evento no calendário da turma; criar atividade gera
  evento de prazo.
- Alteração e cancelamento com notificação automática aos afetados.
- Marcação de dia letivo x não letivo e contagem automática de dias letivos.
- Filtros por tipo, turma, disciplina e instituição.
- Exportação/assinatura para calendários externos. `[RECOMENDAÇÃO — pós-MVP]`

## 9.4 Regras

- Evento em dia não letivo exige confirmação e justificativa.
- Conflitos de sala e de professor são detectados e sinalizados.
- Eventos de calendário institucional não podem ser removidos por perfis de escopo menor.
- Alterar a data de uma avaliação após publicação notifica alunos e professores e fica registrada.

---

# 10. Avaliações, Notas e Desempenho

## 10.1 Modelo de avaliação configurável

A instituição escolhe o modelo por segmento (e possivelmente por série): `[A VALIDAR]`

| Modelo | Descrição | Onde é comum |
| --- | --- | --- |
| **Numérico** | Notas de 0 a 10 (ou 0 a 100), com média ponderada | Fundamental II e Médio |
| **Conceitual** | Conceitos (A/B/C/D, MB/B/R/I, Atingiu/Em desenvolvimento/Não atingiu) | Fundamental I |
| **Parecer descritivo** | Texto avaliativo por área/campo de experiência, sem nota | Educação Infantil |
| **Misto** | Nota + parecer, ou conceito convertido em nota para o histórico | Redes que combinam abordagens |
| **Por competências/habilidades** | Avaliação por descritores da BNCC, agregada em conceito | Escolas com currículo por competências `[RECOMENDAÇÃO — pós-MVP]` |

## 10.2 Estrutura das avaliações

- **Tipo de avaliação:** prova, trabalho, seminário, participação, projeto, simulado, recuperação,
  atividade avaliativa. Configurável por instituição.
- **Peso:** por avaliação e/ou por tipo. Soma dos pesos validada na configuração do período.
- **Valor máximo** e critérios de arredondamento (nº de casas decimais, regra de arredondamento).
- **Vinculação:** período letivo + disciplina + turma.
- **Visibilidade:** rascunho (só professor) → publicada (visível a aluno/responsável).
- **Data de aplicação** e data-limite de lançamento.

## 10.3 Cálculo

- **Média do período** por disciplina: média ponderada das avaliações do período.
- **Recuperação paralela:** aplicada ao período; substitui a média, faz média com ela ou usa a maior
  — configurável.
- **Média anual:** média (simples ou ponderada) dos períodos, conforme configuração.
- **Recuperação final:** aplicada após o último período, com fórmula própria (ex.: média final =
  (média anual + nota da recuperação) / 2, com nota mínima de aprovação).
- **Nota mínima para aprovação** e **frequência mínima** definidas por instituição/segmento.
- Toda fórmula usada no cálculo deve ser exibível ao usuário ("como esta média foi calculada").

## 10.4 Fechamento de período

1. Sistema apura pendências: aulas não registradas, avaliações sem nota, alunos sem lançamento.
2. Professor revisa a prévia por disciplina e confirma o fechamento da sua disciplina.
3. Coordenação/secretaria fecha o período da turma quando todas as disciplinas estiverem fechadas.
4. Notas ficam travadas; boletim é gerado e publicado (conforme configuração).
5. Alterações posteriores exigem solicitação, aprovação, justificativa e ficam auditadas.

## 10.5 Boletim

- Por período e acumulado no ano; contém disciplinas, notas por avaliação (opcional), média do
  período, faltas, percentual de frequência e situação.
- Modelo configurável (numérico, conceitual, com parecer).
- Publicação controlada: a escola define se o boletim aparece automaticamente ao fechar ou apenas
  após liberação.
- Exportável em formato para impressão.

## 10.6 Desempenho e indicadores pedagógicos

**Individual:** evolução por período e disciplina; comparação com a média da turma; disciplinas em
risco; relação entre frequência e desempenho; entregas realizadas x atribuídas.

**Por turma:** média por disciplina e por avaliação; distribuição das notas; percentual acima/abaixo
da média; taxa de entrega de atividades; frequência média; evolução entre períodos.

**Por disciplina/professor:** comparação entre turmas da mesma disciplina; índice de aprovação;
pendências de lançamento. *Usado como apoio pedagógico, não como ranking de docentes.*

**Institucional:** taxa de aprovação/reprovação por série e segmento; alunos em risco; comparação
entre unidades e entre anos letivos.

## 10.7 Acompanhamento de alunos com baixo desempenho

- **Critérios de risco configuráveis:** média abaixo do mínimo em N disciplinas; queda de X pontos
  entre períodos; frequência abaixo do limite; N atividades não entregues; ocorrências recorrentes.
- **Lista de atenção** no dashboard de professor, coordenação e gestão, atualizada continuamente.
- **Alertas automáticos** quando o aluno cruza um limiar.
- **Plano de acompanhamento:** registro de intervenção com responsável, ações, prazo e evolução.
  `[RECOMENDAÇÃO — pós-MVP]`
- **Histórico de intervenções** visível a coordenação e orientação, com sigilo configurável.

---

# 11. Frequência

## 11.1 Modelos de registro

- **Por aula/disciplina** (padrão no Fundamental II e Médio).
- **Por dia/turno** (padrão na Educação Infantil e Fundamental I).
- **Por período do dia** (entrada/saída), em escolas de tempo integral. `[A VALIDAR]`

A instituição escolhe o modelo por segmento; o cálculo de percentual segue o modelo escolhido.

## 11.2 Funcionalidades

- Registro de presença, falta, falta justificada, atraso e saída antecipada.
- Registro em lote com exceções.
- Justificativa com motivo, anexo, autor e data.
- **Abono** de falta (a falta deixa de contar para o percentual) — operação restrita, com
  justificativa obrigatória e auditoria.
- Reabertura de chamada dentro do prazo configurado; depois, apenas com permissão especial.
- Frequência por disciplina, por período e acumulada no ano.
- Histórico completo por aluno, com data, aula, disciplina e responsável pelo registro.
- Relatórios de frequência por turma, disciplina, período e aluno.
- Exportação para uso em programas sociais e obrigações legais (ex.: acompanhamento de frequência
  mínima). `[A VALIDAR]`

## 11.3 Alertas e indicadores

- Aluno com N faltas consecutivas → alerta à coordenação (e ao responsável, quando houver portal).
- Aluno atingindo X% do limite de faltas → alerta preventivo.
- Aluno abaixo da frequência mínima → alerta crítico e sinalização na situação acadêmica.
- Turma com frequência média abaixo do esperado → alerta à gestão.
- Aulas sem chamada registrada → pendência do professor e alerta à coordenação após o prazo.

## 11.4 Permissões

| Ação | Professor | Coordenação | Secretaria | Diretor | Aluno | Responsável* |
| --- | --- | --- | --- | --- | --- | --- |
| Registrar frequência | Sim (suas aulas) | Exceção auditada | Exceção auditada | Não | Não | Não |
| Editar dentro do prazo | Sim | Sim | Sim | Não | Não | Não |
| Editar após o prazo | Não (solicita) | Com permissão | Com permissão | Aprova | Não | Não |
| Justificar falta | Registra | Registra/Aprova | Registra/Aprova | Aprova | Solicita* | Solicita |
| Abonar falta | Não | Com permissão | Com permissão | Aprova | Não | Não |
| Visualizar | Suas turmas | Escopo | Instituição | Instituição | Próprio | Dependentes |

\* conforme política da instituição.

---

# 12. Atividades e Materiais

## 12.1 Justificativa

O módulo é necessário porque conecta o que é pedido ao aluno, o prazo, a entrega e a nota — hoje
disperso entre cadernos, grupos de mensagem e e-mails. Também alimenta indicadores de engajamento
(taxa de entrega), que antecipam risco acadêmico melhor do que a nota isolada.

## 12.2 Atividades

- **Criação:** título, descrição/enunciado, disciplina, turma(s), tipo (tarefa, trabalho, projeto,
  leitura), anexos, data de publicação, prazo de entrega, valor/peso (se avaliativa), forma de
  entrega (online, presencial, sem entrega), permitir entrega atrasada (sim/não, com penalidade
  opcional), individual ou em grupo.
- **Publicação:** rascunho → publicada → encerrada. Publicar gera notificação e evento de prazo.
- **Entrega:** anexo e/ou texto, com data/hora de recebimento e possibilidade de reenvio até o prazo.
- **Acompanhamento:** painel com entregues, pendentes e atrasadas; envio de lembrete aos pendentes.
- **Correção:** nota, feedback textual, anexo de devolutiva, rubrica opcional. `[RECOMENDAÇÃO]`
- **Devolutiva ao aluno:** notificação e visualização do feedback.
- **Integração com notas:** atividade avaliativa vira uma avaliação do período, sem relançamento.
- **Atividade em grupo:** definição dos grupos e nota por grupo, com ajuste individual. `[pós-MVP]`

## 12.3 Materiais de apoio

- Upload e organização por disciplina, turma, período e tópico/unidade.
- Tipos: arquivo, link, vídeo, texto.
- Visibilidade: turma específica, todas as turmas da disciplina, ou biblioteca da instituição.
- Reutilização entre turmas e anos letivos.
- Controle de versão simples (substituir material mantendo histórico). `[RECOMENDAÇÃO]`
- Limites de tamanho e tipos de arquivo definidos pela instituição.

## 12.4 Regras

- Aluno só vê atividades das turmas/disciplinas em que está matriculado e já publicadas.
- Entrega após o prazo é aceita apenas se a atividade permitir, e fica marcada como atrasada.
- Excluir atividade com entregas é proibido; o caminho é encerrar/arquivar.
- Atividade avaliativa não pode ser excluída após o fechamento do período.

---

# 13. Documentos

## 13.1 Categorias

| Categoria | Exemplos |
| --- | --- |
| **Documentos do aluno (recebidos)** | Certidão de nascimento, RG/CPF, comprovante de residência, foto, histórico da escola anterior, laudos, autorizações |
| **Documentos do aluno (emitidos)** | Declaração de matrícula, declaração de frequência, boletim, histórico escolar, guia de transferência, certificado de conclusão, ata de resultado final |
| **Documentos do professor/funcionário** | Diploma, comprovantes, contrato, documentos pessoais |
| **Documentos da instituição** | Regimento interno, PPP, calendário oficial, autorizações, atas, circulares |
| **Documentos financeiros** | Boletos, comprovantes de pagamento, contratos, declaração para IR |

## 13.2 Funcionalidades

- **Checklist de documentação obrigatória** por segmento/série, com status por aluno e alerta de
  pendência.
- **Upload** com metadados: tipo, data, validade, responsável pelo envio, observações.
- **Emissão** a partir de modelos configuráveis com dados do sistema (papel timbrado, numeração
  sequencial, data, responsável, código de verificação).
- **Solicitação de documentos** pelo aluno/responsável, com fila, prazo, status (Solicitado → Em
  análise → Emitido → Entregue → Recusado) e notificação.
- **Assinatura**: identificação do emissor e, futuramente, assinatura eletrônica. `[A VALIDAR]`
- **Verificação de autenticidade** por código/chave. `[RECOMENDAÇÃO — pós-MVP]`
- **Controle de acesso:** cada tipo de documento tem quem pode ver, emitir e baixar.
- **Histórico:** quem emitiu, quando, para quem, e quantas vias — com registro de cada download de
  documento sensível.
- **Retenção e descarte:** prazo de guarda por tipo, conforme legislação e política institucional.

## 13.3 Regras

- Documento emitido é imutável; correção gera nova via com numeração própria e motivo.
- Documentos oficiais só podem ser emitidos com os dados acadêmicos consolidados (período fechado).
- Aluno transferido mantém acesso aos documentos emitidos, conforme política. `[A VALIDAR]`
- Laudos e documentos de saúde são dados sensíveis, com acesso restrito e registro de leitura.

---

# 14. Financeiro

> **Posicionamento:** o financeiro é essencial para escolas privadas e irrelevante para boa parte
> das públicas. Recomenda-se que seja **modular e ativável por instituição**, com um núcleo simples
> no pós-MVP imediato e recursos avançados no futuro.

## 14.1 Estrutura

- **Plano financeiro / tabela de preços:** por ano letivo, segmento e série — valor de matrícula,
  número de parcelas, valor da parcela, vencimento, multa e juros.
- **Contrato de prestação de serviços** vinculado à matrícula, com responsável financeiro.
- **Descontos:** por tipo (irmão, pontualidade, convênio, colaborador), percentual ou valor, período
  de validade e alçada de aprovação.
- **Bolsas:** percentual, integral, com origem (institucional, convênio, programa público), vigência
  e critérios de manutenção.

## 14.2 Operações

| Funcionalidade | Fase |
| --- | --- |
| Cadastro de planos, preços e vencimentos | Pós-MVP |
| Geração de cobranças a partir da matrícula | Pós-MVP |
| Registro manual de pagamento e baixa | Pós-MVP |
| Extrato financeiro por aluno/responsável | Pós-MVP |
| Segunda via e comprovante | Pós-MVP |
| Controle de inadimplência com régua de cobrança | Pós-MVP |
| Descontos e bolsas | Pós-MVP |
| Renegociação e parcelamento de dívida | Futuro |
| Integração com meios de pagamento (boleto, PIX, cartão) e conciliação automática | Futuro |
| Emissão de nota fiscal de serviço | Futuro |
| Declaração anual para Imposto de Renda | Futuro |
| Contas a pagar, folha e fluxo de caixa | Futuro (fora do escopo central) |
| Relatórios financeiros e projeção de receita | Pós-MVP (básico) / Futuro (avançado) |

## 14.3 Regras

- Toda cobrança pertence a uma matrícula e a um responsável financeiro identificado.
- Cancelar matrícula exige tratar as cobranças em aberto (cancelar, manter ou renegociar), com
  decisão registrada.
- Descontos e bolsas acima de determinado percentual exigem aprovação de alçada superior.
- Alterações de valores, descontos e baixas são sempre auditadas.
- Bloqueio por inadimplência: **configurável e limitado.** Não deve impedir o acesso a informações
  acadêmicas obrigatórias nem a documentos exigidos por lei. `[A VALIDAR — restrição legal]`
- Dados financeiros não são visíveis a professores nem a alunos menores de idade.

---

# 15. Relatórios e Indicadores

## 15.1 Relatórios acadêmicos

Alunos matriculados por unidade/série/turma/turno; movimentação (entradas, saídas, transferências,
evasão); lista de presença; frequência por turma/disciplina/aluno; alunos abaixo da frequência
mínima; mapa de notas por turma; boletins em lote; alunos em recuperação; resultado final por turma
e série; ata de resultados; alunos com dependência; desempenho por disciplina e por professor;
comparativo entre períodos e entre anos letivos; ocupação de turmas e vagas disponíveis.

## 15.2 Relatórios administrativos

Usuários por perfil e situação; professores por carga horária e disciplinas; pendências de
lançamento por professor; documentos pendentes por aluno; documentos emitidos por período;
comunicados enviados e taxa de leitura; acessos por perfil; ocupação de salas.

## 15.3 Relatórios financeiros `[pós-MVP]`

Receita prevista x realizada; inadimplência por faixa de atraso; descontos e bolsas concedidos;
pagamentos por período e forma; evolução da receita; alunos inadimplentes por turma.

## 15.4 Indicadores-chave

| Indicador | Fórmula/base | Público |
| --- | --- | --- |
| Total de alunos ativos | Matrículas ativas no ano letivo corrente | Gestão |
| Taxa de ocupação | Matrículas ÷ capacidade das turmas | Gestão |
| Taxa de frequência | Presenças ÷ aulas previstas | Gestão, Coordenação |
| Alunos em risco | Regras configuráveis de nota/frequência/entrega | Coordenação, Professor |
| Taxa de aprovação | Aprovados ÷ concluintes do ano | Gestão |
| Evasão | Matrículas encerradas sem transferência ÷ matrículas iniciais | Gestão |
| Pendências de lançamento | Aulas/notas não registradas dentro do prazo | Coordenação |
| Taxa de leitura de comunicados | Leituras ÷ destinatários | Gestão |
| Inadimplência | Valor vencido em aberto ÷ valor total devido | Financeiro |
| Rematrícula | Rematriculados ÷ elegíveis | Gestão |

## 15.5 Recursos dos relatórios

- Filtros combináveis (ano letivo, unidade, segmento, série, turma, turno, disciplina, professor,
  período, situação).
- Ordenação, agrupamento e totalizadores.
- Salvamento de relatórios favoritos e filtros recorrentes.
- Exportação em formatos de planilha e de impressão.
- Agendamento de envio periódico por e-mail. `[RECOMENDAÇÃO — pós-MVP]`
- Todo relatório respeita o escopo de permissão de quem o executa.
- Registro de auditoria para exportações que contenham dados pessoais.

---

# 16. Dashboard

## 16.1 Princípios

Cada dashboard responde primeiro **"o que exige minha atenção agora"** e depois **"como estamos"**.
Números vêm acompanhados de contexto (variação, meta ou comparativo) e todo card é clicável, levando
à lista detalhada correspondente.

## 16.2 Dashboard da Gestão

**Bloco 1 — Panorama:** total de alunos ativos; matrículas no período; alunos por unidade/segmento;
professores ativos; turmas ativas; taxa de ocupação.

**Bloco 2 — Acadêmico:** frequência média da instituição; alunos abaixo da frequência mínima; média
geral por segmento; alunos em risco; turmas com maior queda de desempenho.

**Bloco 3 — Operacional:** pendências de lançamento por professor; aulas sem registro; períodos
próximos do fechamento; documentos pendentes; solicitações abertas.

**Bloco 4 — Financeiro** *(quando ativo)*: receita prevista x realizada; inadimplência; cobranças a
vencer; descontos concedidos.

**Bloco 5 — Alertas e eventos:** alertas críticos priorizados; próximos eventos do calendário;
comunicados recentes e taxa de leitura.

Filtros globais: ano letivo, unidade, segmento, período letivo.

## 16.3 Dashboard do Professor

Aulas do dia com ação rápida de chamada; turmas do dia; chamadas pendentes; notas a lançar e prazo;
atividades a corrigir; próximas avaliações; alunos que exigem atenção; comunicados não lidos;
resumo da semana. Em cenário multi-instituição, tudo identificado pela escola de origem.

## 16.4 Dashboard do Aluno

Próximas aulas; próximas avaliações e entregas com contagem de prazo; últimas notas publicadas;
frequência atual com indicação de margem; atividades pendentes; comunicados não lidos; eventos
próximos; pendências (documentos, confirmações, financeiro quando aplicável).

## 16.5 Dashboard do Responsável `[pós-MVP]`

Seletor de dependente; resumo por dependente (notas, frequência, próximos compromissos, pendências);
comunicados; situação financeira; autorizações pendentes.

---

# 17. Notificações e Alertas

## 17.1 Classificação por prioridade

| Prioridade | Significado | Canais sugeridos |
| --- | --- | --- |
| **Crítica** | Exige ação imediata ou envolve risco acadêmico/legal | In-app + push + e-mail |
| **Alta** | Prazo curto ou impacto direto na rotina | In-app + push |
| **Média** | Informação relevante, sem urgência | In-app + resumo por e-mail |
| **Baixa** | Informativo | In-app |

## 17.2 Catálogo de eventos notificáveis

| Evento | Destinatário | Prioridade |
| --- | --- | --- |
| Convite de acesso / primeiro acesso | Usuário convidado | Alta |
| Matrícula confirmada | Aluno, responsável, secretaria | Alta |
| Alteração de turma | Aluno, responsável, professores afetados | Alta |
| Nova atividade publicada | Alunos da turma | Média |
| Prazo de entrega em 48h / 24h | Alunos com entrega pendente | Alta |
| Atividade corrigida / feedback | Aluno | Média |
| Nova avaliação agendada | Alunos da turma | Média |
| Nota publicada | Aluno, responsável | Média |
| Boletim disponível | Aluno, responsável | Alta |
| Falta registrada | Aluno, responsável | Média |
| Faltas consecutivas / excesso de faltas | Aluno, responsável, coordenação | Crítica |
| Desempenho abaixo do limiar | Aluno, responsável, coordenação | Alta |
| Alteração de horário / sala / cancelamento de aula | Turma e professor | Alta |
| Novo comunicado | Público segmentado | Média a Crítica (conforme marcação) |
| Confirmação de leitura pendente | Destinatário que não leu | Alta |
| Documento disponível / solicitação atendida | Solicitante | Alta |
| Documentação pendente | Aluno, responsável, secretaria | Alta |
| Pendência de chamada / notas | Professor | Alta |
| Prazo de fechamento do período | Professor, coordenação | Crítica |
| Período fechado | Coordenação, secretaria | Média |
| Evento próximo (24h) | Participantes | Média |
| Vencimento próximo / cobrança em atraso | Responsável financeiro | Alta / Crítica |
| Vínculo criado, alterado ou encerrado | Usuário afetado, administrador | Alta |
| Acesso de novo dispositivo / alteração de senha | Titular da conta | Crítica |
| Solicitação de alteração de nota fechada | Aprovador | Alta |

## 17.3 Regras

- Toda notificação carrega instituição, contexto e link direto para a ação.
- Agrupamento e antirruído: eventos repetidos são consolidados em um resumo (ex.: "5 notas
  publicadas hoje").
- Preferências por usuário, por tipo e por canal; notificações críticas não podem ser desativadas.
- Notificações não substituem o registro: tudo permanece consultável na central de notificações e no
  histórico de comunicação.
- Janela de silêncio configurável (ex.: não enviar push entre 21h e 7h), exceto para eventos
  críticos. `[RECOMENDAÇÃO]`

---

# 18. Permissões e Controle de Acesso

## 18.1 Modelo

O controle é baseado em **papéis com permissões granulares e escopo**:

`Permissão = Recurso + Ação + Escopo`

- **Recursos:** instituição, unidade, ano letivo, usuário, papel, professor, aluno, responsável,
  matrícula, turma, disciplina, grade, horário, aula/diário, frequência, avaliação, nota, atividade,
  material, comunicado, documento, financeiro, relatório, auditoria, configuração.
- **Ações:** visualizar, criar, editar, excluir/arquivar, aprovar, publicar, exportar, emitir,
  atribuir/vincular, configurar.
- **Escopos:** instituição inteira; unidade; segmento/série; turma; disciplina/oferta; próprio
  usuário; dependentes.

## 18.2 Regras

1. Toda verificação de permissão considera **instituição + escopo + papel**, nesta ordem.
2. Não existe acesso implícito: ausência de permissão é negação.
3. Permissões são atribuídas ao **vínculo**, nunca à pessoa.
4. Papéis pré-definidos podem ser clonados e customizados; papéis do sistema não são editáveis, para
   garantir um baseline previsível.
5. Um usuário com múltiplos papéis na mesma instituição recebe a união das permissões; restrições
   explícitas prevalecem sobre concessões. `[A VALIDAR]`
6. Permissões sensíveis (alterar nota fechada, abonar falta, excluir dados, exportar dados pessoais,
   configurar permissões, acessar auditoria) formam um grupo especial: exigem atribuição explícita,
   e cada uso é auditado.
7. Escopo por turma/disciplina é derivado automaticamente das alocações do professor — não é
   configurado à mão.
8. Revogação de vínculo encerra sessões e acessos imediatamente.
9. Delegação temporária tem data de fim obrigatória.
10. Nenhum perfil operacional acessa dados de outra instituição, mesmo com papel de administrador na
    sua própria.

## 18.3 Cenários de teste obrigatórios

- Professor da Escola A tenta acessar turma da Escola B → negado.
- Professor tenta acessar turma da própria escola à qual não está alocado → negado.
- Aluno tenta acessar dados de outro aluno → negado.
- Aluno tenta acessar sua nota antes da publicação → não visível.
- Coordenador de uma unidade tenta acessar outra unidade → negado.
- Financeiro tenta acessar diário de classe → negado.
- Professor com vínculo encerrado tenta acessar turma antiga → negado (ou somente-leitura conforme
  política).
- Usuário sem vínculo ativo em nenhuma instituição → acesso apenas ao perfil pessoal.

---

# 19. Multi-instituição

## 19.1 Conceito

A plataforma parte da premissa de que **a pessoa é única e os vínculos são múltiplos**. O caso
canônico: *João é professor da Escola A e da Escola B.* Ele entra uma vez, vê seus compromissos das
duas escolas e, ao trabalhar, está sempre dentro do contexto de uma delas.

O mesmo vale para outros perfis: um gestor pode coordenar duas unidades; um aluno pode estudar em
uma escola regular e em um curso técnico; um responsável pode ter filhos em instituições diferentes.

## 19.2 Requisitos

| # | Requisito |
| --- | --- |
| MI-1 | Uma pessoa possui uma única identidade e credencial na plataforma. |
| MI-2 | Um vínculo relaciona pessoa + instituição (+ unidade opcional) + papel + período + situação. |
| MI-3 | Um usuário pode ter N vínculos simultâneos, em instituições diferentes ou na mesma. |
| MI-4 | Convidar alguém que já possui conta cria um novo vínculo, nunca uma nova conta. |
| MI-5 | Após o login, se houver mais de um vínculo ativo, o sistema apresenta a escolha de contexto; com um único vínculo, entra direto nele. |
| MI-6 | O contexto ativo (instituição, unidade, ano letivo) fica visível de forma permanente na interface. |
| MI-7 | A troca de contexto é feita em um clique, sem novo login, e recarrega o escopo de dados e permissões. |
| MI-8 | Permissões são independentes por vínculo: ser administrador na Escola A não concede nada na Escola B. |
| MI-9 | Dados de instituições diferentes nunca aparecem juntos em uma mesma listagem operacional. |
| MI-10 | A única exceção é a **visão agregada pessoal** (agenda, pendências, notificações), que exibe apenas metadados operacionais rotulados por instituição — jamais dados de alunos ou dados sensíveis. |
| MI-11 | Cada instituição mantém suas próprias configurações, calendário, modelo de avaliação, papéis, identidade visual e políticas. |
| MI-12 | O histórico de vínculos é preservado: início, fim, papel, unidade, motivo do encerramento e quem executou. |
| MI-13 | Encerrar um vínculo remove o acesso ao contexto, mas preserva os registros que a pessoa produziu (aulas, notas, comunicados), com sua autoria. |
| MI-14 | Um usuário sem nenhum vínculo ativo mantém a conta, acessa apenas seus dados pessoais e pode receber novos convites. |
| MI-15 | Preferências pessoais (idioma, tema, notificações) são da pessoa; preferências operacionais podem ser por vínculo. |
| MI-16 | Conflitos de agenda entre instituições diferentes são sinalizados ao usuário, sem revelar detalhes da outra instituição a terceiros. |
| MI-17 | Uma instituição não pode ver os outros vínculos de uma pessoa, apenas o vínculo que mantém com ela. |
| MI-18 | Exclusão/exportação de dados pessoais (LGPD) considera a pessoa, mas respeita as obrigações de guarda de cada instituição. |

---

# 20. Auditoria e Histórico

## 20.1 Conteúdo mínimo de um registro de auditoria

Quem (usuário e vínculo/papel); quando (data e hora com fuso); o que (recurso e identificador); qual
ação; valor anterior e novo valor; instituição e unidade; usuário/entidade relacionada (ex.: aluno
afetado); origem do acesso (aplicação/dispositivo, de forma proporcional); justificativa, quando a
operação exigir.

## 20.2 Operações que exigem auditoria obrigatória

**Acadêmico:** criar/alterar/excluir nota; alterar nota após fechamento; fechar e reabrir período;
alterar frequência fora do prazo; abonar ou justificar falta; alterar resultado final; aprovar pelo
conselho; alterar grade curricular; excluir/arquivar avaliação com notas.

**Cadastral e acadêmico-formal:** criar/alterar/cancelar matrícula; transferir aluno (interna ou
externa); alterar dados pessoais de aluno, professor ou responsável; alterar vínculo
responsável↔aluno; alterar situação acadêmica.

**Acesso e segurança:** criar/alterar/remover vínculo; alterar papel ou permissões; criar/editar
papel customizado; login com falha repetida; alteração de senha; encerramento de sessão remoto;
acesso de suporte da plataforma.

**Documentos e dados:** emitir documento oficial; baixar documento sensível; exportar relatório com
dados pessoais; anexar/remover documento; solicitar exclusão de dados (LGPD).

**Comunicação:** enviar comunicado institucional; retificar comunicado; excluir mensagem.

**Financeiro:** gerar/cancelar cobrança; registrar/estornar pagamento; conceder desconto ou bolsa;
renegociar dívida; alterar plano financeiro.

**Configuração:** alterar modelo de avaliação, frequência mínima, prazos, calendário, ano letivo e
qualquer política institucional.

## 20.3 Regras

- A trilha de auditoria é **somente-adição**: não pode ser editada nem apagada por nenhum perfil.
- Acesso à auditoria é restrito e o próprio acesso é registrado.
- Consulta com filtros por período, usuário, recurso, ação e aluno afetado; exportação controlada.
- O histórico funcional (ex.: histórico de notas de um aluno, histórico de turmas, histórico de
  vínculos) é apresentado ao usuário na própria tela do recurso, sem exigir acesso à auditoria
  técnica.
- Prazo de retenção definido por política, respeitando obrigações legais.

---

# 21. Busca e Navegação

## 21.1 Busca global

- Campo único, sempre acessível, com atalho de teclado.
- Busca **dentro do contexto ativo** (instituição/unidade), com aviso claro do escopo.
- Entidades pesquisáveis: aluno (nome, nome social, matrícula, documento, responsável), professor,
  responsável, turma, disciplina, matrícula, documento, atividade, avaliação, comunicado, evento,
  sala, usuário.
- Resultados agrupados por tipo, com ações rápidas ("ver ficha", "ver notas", "emitir declaração").
- Tolerância a erros de digitação e acentuação; busca por nome parcial.
- Resultados respeitam permissões: o usuário nunca vê nem a existência de um registro fora do seu
  escopo.
- Histórico de buscas recentes e itens recentemente acessados.

## 21.2 Busca contextual e filtros

- Toda listagem tem busca própria, filtros combináveis, ordenação e paginação (ou carregamento
  progressivo) com contagem total.
- Filtros persistem na navegação e podem ser salvos como visão favorita.
- Filtros comuns: ano letivo, unidade, segmento, série, turma, turno, disciplina, professor, período,
  situação, faixa de nota, faixa de frequência.
- Seleção múltipla para ações em lote, com confirmação e resumo do que será feito.

## 21.3 Navegação

- Estrutura de navegação por perfil, com no máximo dois níveis de menu.
- Barra de contexto fixa: instituição, unidade e ano letivo ativos.
- Trilha de navegação (breadcrumb) em telas profundas.
- Atalhos para ações frequentes por perfil (chamada do dia, lançar notas, nova matrícula, novo
  comunicado).
- Links diretos e endereços estáveis para telas, permitindo compartilhar referência interna.
- Acesso rápido a "recentes" e "favoritos".

---

# 22. Experiência e Interface

## 22.1 Princípios

| Princípio | Aplicação |
| --- | --- |
| **Modernidade** | Layout limpo, espaçamento generoso, tipografia legível, componentes consistentes. |
| **Clareza** | Uma tela, um objetivo principal. Rótulos em linguagem da escola, não em jargão de sistema. |
| **Organização** | Agrupamento por afinidade, hierarquia visual explícita, densidade ajustada ao perfil. |
| **Controle** | O usuário sabe onde está, o que vai acontecer e como desfazer. |
| **Confiança** | Feedback imediato de salvamento, indicação de última atualização, mensagens honestas de erro. |
| **Profissionalismo** | Ausência de ruído decorativo; foco em dados e ações. |

## 22.2 Diretrizes

- **Hierarquia visual:** o número/estado mais importante primeiro; detalhes sob demanda
  (progressive disclosure).
- **Densidade adaptativa:** telas de gestão suportam tabelas densas; telas de professor e aluno
  privilegiam cards e ações grandes.
- **Feedback de ação:** confirmação visível para toda ação, com desfazer quando possível.
- **Estados vazios** com explicação e ação sugerida ("Nenhuma turma criada ainda — criar turma").
- **Estados de carregamento** com esqueleto de conteúdo, não bloqueio de tela.
- **Estados de erro** que explicam o que houve, o que fazer e preservam o que foi digitado.
- **Prevenção de perda de dados:** rascunho automático em formulários longos e aviso ao sair.
- **Confirmação proporcional ao risco:** ações irreversíveis exigem confirmação explícita e
  descrição do impacto.
- **Consistência entre perfis:** mesmos ícones, cores semânticas e vocabulário nas três vias.
- **Identidade da instituição** presente (logo, cor), sem quebrar a legibilidade nem a consistência.
- **Idioma:** português do Brasil como padrão; estrutura preparada para outros idiomas.
- **Acessibilidade:** contraste adequado, navegação por teclado, foco visível, leitores de tela,
  toque confortável, nunca usar apenas cor para transmitir informação, textos alternativos.
- **Impressão:** telas-chave (boletim, lista de presença, mapa de notas, boleto) com versão
  imprimível legível.

---

# 23. Responsividade e Multiplataforma

## 23.1 Diretriz geral

Todas as funcionalidades essenciais devem ser utilizáveis em qualquer dispositivo. O que muda é a
**prioridade de apresentação**, não o direito de acesso.

## 23.2 Prioridades por perfil e dispositivo

| Perfil | Desktop | Tablet | Smartphone |
| --- | --- | --- | --- |
| **Gestão** | Uso primário: cadastros, relatórios, configurações, tabelas densas, ações em lote | Consulta e aprovações | Dashboard, alertas, aprovações rápidas, busca de aluno, comunicados |
| **Professor** | Lançamento de notas em grade, criação de avaliações e atividades, correção | Uso primário em sala: chamada, diário, consulta de alunos | Chamada rápida, agenda do dia, pendências, comunicados, consulta pontual |
| **Aluno** | Consulta ampla, entrega de trabalhos, leitura de materiais | Leitura e entrega | Uso primário: horário do dia, notas, frequência, prazos, comunicados, entrega simples |

## 23.3 Requisitos

- Layout fluido, do celular ao monitor amplo, sem rolagem horizontal indesejada.
- Tabelas grandes se transformam em listas/cards em telas pequenas, preservando as ações principais.
- Alvos de toque adequados e formulários otimizados para teclado móvel.
- Desempenho em rede lenta: carregamento progressivo, listas paginadas, imagens otimizadas.
- Tolerância a instabilidade: falha de conexão preserva o que foi digitado e permite reenvio.
- **Chamada com uso offline parcial** e sincronização posterior. `[RECOMENDAÇÃO — pós-MVP]`
- Instalação como aplicativo na tela inicial e notificações push. `[pós-MVP]`
- Aplicativos nativos dedicados para professor e aluno. `[Futuro]`

---

# 24. Segurança e Privacidade

## 24.1 Controle de acesso e sessões

- Autenticação individual; contas compartilhadas não são permitidas.
- Política de senha forte e bloqueio temporário após tentativas falhas.
- Segundo fator de autenticação, obrigatório para perfis administrativos. `[RECOMENDAÇÃO]`
- Sessões com expiração por inatividade, listagem de sessões ativas e encerramento remoto.
- Recuperação de acesso por canal verificado, com expiração do link e notificação ao titular.
- Primeiro acesso força definição de senha própria e aceite dos termos.
- Encerramento de vínculo revoga acesso imediatamente.

## 24.2 Isolamento entre instituições

- O escopo de instituição é obrigatório em toda consulta e operação de domínio.
- Nenhuma listagem, busca, relatório, exportação, notificação ou anexo cruza instituições.
- Anexos e documentos herdam o escopo do registro de origem e não são acessíveis por endereço direto
  sem verificação de permissão.
- Testes automatizados de isolamento devem fazer parte do critério de aceite de cada módulo.

## 24.3 Classificação e proteção de dados

| Nível | Exemplos | Tratamento |
| --- | --- | --- |
| **Sensível (proteção máxima)** | Laudos e condições de saúde, deficiência, medicações, alergias, dados biométricos, origem racial/étnica, religião, dados de menores, restrições judiciais, ocorrências disciplinares graves | Acesso restrito a papéis específicos, leitura registrada, nunca exibido em listas gerais, exportação controlada |
| **Pessoal identificável** | Nome, documentos, endereço, contatos, foto, data de nascimento, filiação | Acesso por necessidade, mascaramento parcial em listagens quando desnecessário, auditoria de exportação |
| **Acadêmico** | Notas, frequência, resultado, ocorrências, histórico | Visível apenas ao titular, seu responsável e aos perfis do escopo |
| **Financeiro** | Contratos, cobranças, pagamentos, inadimplência | Visível ao responsável financeiro e ao perfil financeiro da escola |
| **Operacional** | Turmas, disciplinas, horários, calendário | Amplo dentro da instituição |

## 24.4 Privacidade e LGPD

- **Finalidade e minimização:** coletar apenas o necessário; cada campo sensível deve ter finalidade
  declarada.
- **Base legal:** execução de contrato e obrigação legal para dados acadêmicos; consentimento (do
  responsável, no caso de menores) para usos acessórios como imagem e comunicação promocional.
- **Direitos do titular:** acesso, correção, portabilidade, informação sobre compartilhamento e
  eliminação quando não houver obrigação de guarda. Deve existir um fluxo para registrar e responder
  a essas solicitações, com prazo e trilha.
- **Retenção:** prazos por tipo de dado; dados acadêmicos obrigatórios têm guarda prolongada por
  legislação educacional; dados acessórios são eliminados ao fim da finalidade.
- **Anonimização** para estatísticas e comparativos.
- **Consentimentos** (uso de imagem, comunicação, saída autorizada) registrados com data, versão do
  termo e possibilidade de revogação.
- **Transparência:** aviso de privacidade acessível e histórico de aceites.
- **Incidentes:** procedimento de identificação, registro, comunicação ao titular e à autoridade,
  quando aplicável.
- **Suporte da plataforma:** acesso excepcional, temporário, justificado, auditado e comunicado à
  instituição.

## 24.5 Requisitos gerais de segurança

- Proteção de dados em trânsito e em repouso.
- Registro de eventos de segurança e monitoramento de acessos anômalos.
- Cópias de segurança com testes periódicos de restauração e plano de continuidade.
- Verificação de arquivos enviados (tipo, tamanho, conteúdo malicioso).
- Limites de uso para evitar abuso e extração massiva de dados.
- Segregação de ambientes: dados reais não são usados em ambiente de teste sem anonimização.

---

# 25. Estados e Regras de Negócio das Entidades

## 25.1 Aluno (situação na instituição)

`Pré-matrícula → Ativo → (Trancado | Transferido | Evadido | Concluído | Cancelado) → Inativo/Egresso`

| Estado | Significado | Regras |
| --- | --- | --- |
| Pré-matrícula | Intenção registrada, sem vaga confirmada | Não aparece em diários; expira no prazo configurado |
| Ativo | Matrícula vigente | Aparece em diários, recebe comunicados, tem acesso ao portal |
| Trancado | Suspensão temporária com retorno previsto | Não conta em frequência; retorno exige reativação |
| Transferido | Saiu para outra instituição | Documentos de saída emitidos; acesso ao contexto encerrado |
| Evadido | Abandono sem transferência formal | Entra em indicador de evasão; exige registro de tentativas de contato |
| Concluído | Concluiu a etapa final | Vira egresso; mantém acesso ao histórico conforme política |
| Cancelado | Matrícula desfeita | Exige motivo e tratamento financeiro |
| Inativo | Sem vínculo ativo | Sem acesso ao contexto; dados preservados |

## 25.2 Matrícula

`Pendente → Ativa → (Suspensa | Cancelada | Transferida | Concluída)`

- Pendente: aguardando documentação, vaga, assinatura ou pagamento inicial.
- Ativa: gera presença em diários e cobranças.
- Suspensa: acesso limitado, sem exclusão de registros.
- Cancelada: exige motivo, data e tratamento das cobranças.
- Transferida: gera documentos de saída.
- Concluída: ao encerrar o ano letivo com resultado apurado.

## 25.3 Turma

`Planejada → Aberta → Em andamento → Encerrada` / `Cancelada`

- Planejada: em montagem, sem matrículas efetivadas.
- Aberta: recebe matrículas; grade e professores em definição.
- Em andamento: ano letivo iniciado; permite diários e lançamentos.
- Encerrada: resultados apurados; somente-leitura.
- Cancelada: só permitido sem matrículas ativas; exige remanejamento prévio.

## 25.4 Ano letivo

`Em planejamento → Aberto → Corrente → Em encerramento → Encerrado` (`Arquivado`)

- Em encerramento: só permite fechamento de períodos e correções autorizadas.
- Encerrado: congela lançamentos; alterações exigem reabertura formal e auditada.

## 25.5 Período letivo

`Planejado → Aberto → Em fechamento → Fechado` (`Reaberto`)

- Aberto: aceita lançamentos de notas e frequência.
- Em fechamento: aceita apenas conclusão de pendências.
- Fechado: travado; boletim disponível.
- Reaberto: estado excepcional, com prazo, justificativa, aprovador e auditoria.

## 25.6 Aula / registro de diário

`Prevista → Registrada → Fechada` / `Cancelada` / `Não ocorrida` / `Reposta`

## 25.7 Avaliação

`Rascunho → Publicada → Em correção → Notas lançadas → Fechada` / `Cancelada`

## 25.8 Nota

`Não lançada → Rascunho → Publicada → Consolidada → Retificada`

- Retificação após consolidação exige solicitação, aprovação, motivo e mantém o valor anterior.

## 25.9 Atividade

`Rascunho → Publicada → Em andamento → Prazo encerrado → Em correção → Corrigida → Arquivada`

## 25.10 Entrega de atividade

`Pendente → Entregue → Entregue com atraso → Em correção → Corrigida → Devolvida para ajuste → Não entregue`

## 25.11 Vínculo de usuário

`Convidado → Pendente de aceite → Ativo → (Suspenso | Encerrado | Expirado)`

## 25.12 Comunicado

`Rascunho → Agendado → Publicado → Retificado → Expirado → Arquivado`

## 25.13 Solicitação de documento

`Solicitada → Em análise → Em emissão → Emitida → Entregue` / `Recusada` / `Cancelada`

## 25.14 Documento emitido

`Emitido → Válido → (Substituído | Cancelado | Expirado)`

## 25.15 Cobrança financeira `[pós-MVP]`

`Prevista → Emitida → (Paga | Paga parcialmente | Vencida | Em negociação | Renegociada | Cancelada | Isenta)`

## 25.16 Professor (vínculo docente)

`Convidado → Ativo → (Afastado | Substituído | Desligado)`

## 25.17 Instituição

`Em implantação → Ativa → (Suspensa | Encerrada)`

---

# 26. Automações

> Nesta fase apenas se identifica **o que** pode ser automatizado e **em que condição**. Nada aqui
> define implementação.

| # | Automação | Gatilho / condição | Efeito |
| --- | --- | --- | --- |
| A-01 | Geração das aulas do diário | Turma com horário e calendário definidos | Cria as aulas previstas do período |
| A-02 | Lembrete de chamada pendente | Aula encerrada há X horas sem registro | Notifica professor; após Y horas, notifica coordenação |
| A-03 | Alerta de faltas consecutivas | N faltas seguidas do aluno | Notifica coordenação e responsável; registra alerta |
| A-04 | Alerta de frequência crítica | Frequência abaixo de X% do mínimo | Notifica coordenação, aluno e responsável; sinaliza no dashboard |
| A-05 | Alerta de desempenho | Média abaixo do mínimo, ou queda de X pontos entre períodos | Inclui aluno na lista de atenção e notifica |
| A-06 | Lembrete de entrega | 48h e 24h antes do prazo, para quem não entregou | Notifica aluno (e responsável) |
| A-07 | Lembrete de prazo de lançamento | X dias antes do fim do período | Notifica professores com pendências |
| A-08 | Cálculo de médias e situação | Nota publicada ou alterada | Recalcula média, frequência e situação da disciplina |
| A-09 | Fechamento assistido de período | Data de fechamento atingida | Lista pendências, propõe fechamento, bloqueia após confirmação |
| A-10 | Geração de boletins | Período fechado | Gera boletins da turma e publica conforme configuração |
| A-11 | Apuração de resultado final | Último período fechado | Calcula resultado por disciplina e final; sinaliza recuperação |
| A-12 | Proposta de rematrícula | Ano letivo encerrado | Sugere série seguinte por aluno e gera pendências |
| A-13 | Expiração de pré-matrícula | Prazo sem confirmação | Muda situação e libera a vaga |
| A-14 | Cobrança de documentação | Documento obrigatório pendente após X dias | Notifica responsável e secretaria |
| A-15 | Régua de cobrança financeira | Vencimento próximo, no vencimento e em atraso | Notifica responsável financeiro `[pós-MVP]` |
| A-16 | Geração de cobranças | Matrícula confirmada | Cria as parcelas conforme o plano `[pós-MVP]` |
| A-17 | Relatórios recorrentes | Agenda definida pelo gestor | Envia relatório por e-mail `[pós-MVP]` |
| A-18 | Reenvio de comunicado | Comunicado com confirmação obrigatória não lido após X dias | Reenvia apenas aos não-leitores |
| A-19 | Notificação de alteração de horário | Alteração publicada | Notifica turma e professores afetados |
| A-20 | Encerramento de vínculo | Data-fim atingida | Revoga acesso e notifica administrador |
| A-21 | Expiração de convite | Convite não aceito no prazo | Invalida convite e avisa quem convidou |
| A-22 | Detecção de conflito de horário | Alocação de professor/sala | Alerta no momento da montagem da grade |
| A-23 | Contagem de dias letivos | Alteração no calendário | Recalcula e alerta se abaixo do mínimo |
| A-24 | Arquivamento por retenção | Prazo de guarda vencido | Marca para revisão e eliminação, conforme política LGPD |
| A-25 | Resumo periódico | Semanal/diário, por preferência | Envia digest de pendências e novidades por perfil |

---

# 27. Requisitos Funcionais

> Prioridade: **P0** crítica (MVP), **P1** alta, **P2** média, **P3** baixa.
> Formato resumido para requisitos de menor complexidade; detalhado nos requisitos centrais.

## 27.1 Identidade, acesso e multi-instituição

### RF-001 — Autenticação do usuário
- **Descrição:** permitir que uma pessoa acesse a plataforma com identidade única.
- **Usuários:** todos.
- **Pré-condições:** conta criada por convite ou provisionamento; vínculo existente.
- **Fluxo principal:** informa credencial → sistema valida → registra acesso → direciona ao contexto.
- **Fluxos alternativos:** credencial inválida (mensagem genérica, contagem de tentativas); conta
  bloqueada; recuperação de acesso; primeiro acesso com definição de senha.
- **Regras:** bloqueio temporário após N tentativas; sessão expira por inatividade; usuário sem
  vínculo ativo acessa apenas o perfil pessoal.
- **Resultado:** sessão autenticada com contexto definido.
- **Prioridade:** P0.

### RF-002 — Seleção e troca de contexto de instituição
- **Descrição:** permitir escolher e alternar entre as instituições às quais o usuário está vinculado.
- **Usuários:** todos com 2+ vínculos.
- **Pré-condições:** ao menos dois vínculos ativos.
- **Fluxo principal:** após o login, o sistema lista os vínculos → usuário escolhe → escopo e
  permissões são aplicados → contexto fica visível na interface.
- **Fluxos alternativos:** vínculo único (entra direto); vínculo suspenso (não selecionável, com
  motivo); troca durante a navegação (retorna ao equivalente ou ao início do novo contexto).
- **Regras:** permissões são recalculadas a cada troca; nenhum dado do contexto anterior permanece
  visível.
- **Resultado:** usuário operando dentro de uma instituição, com dados isolados.
- **Prioridade:** P0.

### RF-003 — Convite e vinculação de usuários
- **Descrição:** convidar pessoas para atuar na instituição com papel e escopo definidos.
- **Usuários:** administrador, gestor com permissão.
- **Pré-condições:** instituição ativa; papel existente.
- **Fluxo principal:** informa e-mail, papel, escopo e período → sistema envia convite → pessoa
  aceita → vínculo ativo.
- **Fluxos alternativos:** pessoa já cadastrada (acrescenta vínculo); convite expirado (reenvio);
  convite revogado; e-mail inválido.
- **Regras:** um convite corresponde a um vínculo; convite tem validade; papéis sensíveis exigem
  permissão específica.
- **Resultado:** vínculo criado e auditado.
- **Prioridade:** P0.

### RF-004 — Gestão de papéis e permissões
- **Descrição:** definir papéis e as permissões de cada um, por recurso, ação e escopo.
- **Usuários:** administrador.
- **Fluxo principal:** cria/clona papel → seleciona permissões → define escopo → salva → atribui a
  vínculos.
- **Fluxos alternativos:** edição de papel em uso (aviso de impacto e nº de usuários afetados);
  tentativa de editar papel do sistema (bloqueado); remoção de papel em uso (bloqueada).
- **Regras:** permissões sensíveis exigem atribuição explícita; alterações são auditadas e passam a
  valer na próxima requisição do usuário afetado.
- **Prioridade:** P0 (papéis pré-definidos) / P1 (papéis customizados).

### RF-005 — Encerramento e suspensão de vínculo — P0
Encerrar ou suspender o vínculo revoga o acesso imediatamente, encerra sessões, preserva os registros
produzidos e mantém histórico do vínculo. Auditado.

### RF-006 — Gestão de sessões e recuperação de acesso — P0
Listar sessões ativas, encerrar remotamente, redefinir senha por canal verificado, notificar o
titular sobre eventos de segurança.

## 27.2 Instituição e estrutura

### RF-010 — Cadastro e configuração da instituição — P0
Manter dados institucionais, contato, endereço, identidade visual e configurações gerais (modelo de
avaliação, frequência mínima, prazos, política de comunicação, numeração de documentos).

### RF-011 — Gestão de unidades — P1
Criar e manter unidades com endereço, turnos, capacidade e gestor; usar a unidade como escopo de
permissão e de calendário.

### RF-012 — Gestão de anos letivos — P0
Criar ano letivo, definir início/fim, marcá-lo como corrente, abrir, encerrar e reabrir com
auditoria. Regras: períodos devem cobrir o ano sem sobreposição; encerrar exige períodos fechados.

### RF-013 — Gestão de períodos letivos — P0
Definir quantidade, nomes, datas, pesos e prazos de lançamento e fechamento por segmento.

### RF-014 — Catálogo de disciplinas — P0
Manter disciplinas com sigla, área, tipo, se compõe média e se controla frequência.

### RF-015 — Grade curricular por série/curso — P1
Definir disciplinas e cargas horárias por série e ano letivo; turmas herdam a grade.

### RF-016 — Gestão de séries, segmentos e cursos — P1
Manter a estrutura de oferta da instituição.

### RF-017 — Gestão de salas e ambientes — P2
Cadastrar salas com capacidade e recursos; usar na grade e detectar conflitos.

### RF-018 — Calendário acadêmico — P0
Definir dias letivos, feriados, recessos e eventos; contar dias letivos e alertar sobre o mínimo.

## 27.3 Pessoas

### RF-020 — Cadastro de professores — P0
Manter dados pessoais e profissionais, disciplinas habilitadas, carga horária e situação do vínculo.

### RF-021 — Cadastro de alunos — P0
Manter dados pessoais, complementares, de saúde (sensíveis), documentos e responsáveis.

### RF-022 — Cadastro de responsáveis e vínculo com o aluno — P0
Registrar responsável legal, financeiro e de contato, com grau de parentesco e restrições.

### RF-023 — Importação em lote de alunos, professores e matrículas — P1
Importar por planilha com validação prévia, pré-visualização, relatório de erros e possibilidade de
desfazer a importação.

### RF-024 — Ficha completa do aluno — P0
Visão única com dados cadastrais, matrícula, turma, notas, frequência, documentos, ocorrências,
financeiro (conforme permissão) e histórico.

## 27.4 Acadêmico

### RF-030 — Criação e gestão de turmas — P0
- **Fluxo principal:** escolhe ano letivo, unidade, série, turno, capacidade e sala → sistema propõe
  as disciplinas da grade → gestor ajusta → turma criada como Planejada/Aberta.
- **Alternativos:** duplicar turma existente; turma sem grade definida (exige seleção manual);
  capacidade excedida (alerta).
- **Regras:** turma não pode mudar de ano letivo; encerrar exige períodos fechados.

### RF-031 — Alocação de professores em disciplinas — P0
Vincular professor(es) à oferta de disciplina, com detecção de conflito de horário e alerta de
incompatibilidade com as disciplinas habilitadas.

### RF-032 — Montagem da grade de horários — P1
Definir aulas semanais por turma, disciplina, professor, sala e horário, com detecção de conflitos e
publicação para professores e alunos.

### RF-033 — Matrícula de aluno — P0
Conforme fluxo detalhado em 5.1.

### RF-034 — Rematrícula em lote — P1
Propor progressão, confirmar em lote, gerar matrículas do ano seguinte e registrar não
rematriculados.

### RF-035 — Transferência de aluno (saída) — P1
Registrar saída, apurar notas e faltas, gerar documentos, encerrar matrícula.

### RF-036 — Transferência interna de turma — P1
Trocar a turma preservando lançamentos e registrando o histórico.

### RF-037 — Cancelamento e trancamento de matrícula — P1
Registrar motivo, data de efeito e tratamento financeiro; auditar.

### RF-038 — Diário de classe — P0
Registrar conteúdo, frequência, ocorrências e anexos por aula; controlar aulas pendentes; permitir
edição dentro do prazo e exigir justificativa fora dele.

### RF-039 — Registro de frequência — P0
Conforme seção 11; inclui presença, falta, falta justificada, atraso, registro em lote e edição
controlada.

### RF-040 — Justificativa e abono de faltas — P1
Registrar justificativa com anexo; abono restrito, com motivo obrigatório e auditoria.

### RF-041 — Criação de avaliações — P0
Definir tipo, peso, valor, data, período, disciplina e turma; publicar ou manter em rascunho.

### RF-042 — Lançamento de notas — P0
- **Fluxo principal:** professor abre a grade da avaliação → lança notas → salva rascunho → publica.
- **Alternativos:** aluno sem nota (alerta no fechamento); nota fora do intervalo (bloqueio);
  lançamento após o prazo (exige permissão); correção de nota publicada (registra histórico).
- **Regras:** apenas o professor da oferta lança; publicação torna a nota visível ao aluno.

### RF-043 — Recuperação — P1
Registrar recuperação paralela e final, com recálculo automático conforme a regra da instituição.

### RF-044 — Fechamento de período — P0
Validar pendências, apresentar prévia, fechar por disciplina e por turma, travar lançamentos e gerar
boletins.

### RF-045 — Reabertura de período e alteração de nota fechada — P1
Fluxo de solicitação → aprovação → alteração → auditoria, com prazo e justificativa obrigatórios.

### RF-046 — Conselho de classe — P2
Painel da turma, registro de pareceres e decisões, geração de ata.

### RF-047 — Apuração de resultado final — P1
Calcular resultado por disciplina e final, considerando nota, frequência, recuperação e decisões do
conselho.

### RF-048 — Histórico escolar — P1
Consolidar e emitir o histórico, incluindo períodos importados de outras instituições.

### RF-049 — Boletim — P0
Gerar, publicar e disponibilizar o boletim por período e anual.

### RF-050 — Ocorrências pedagógicas e disciplinares — P2
Registrar ocorrência com tipo, descrição, autor, visibilidade e encaminhamento.

## 27.5 Atividades, materiais e comunicação

### RF-060 — Criação e publicação de atividades — P1
### RF-061 — Entrega de atividade pelo aluno — P1
### RF-062 — Correção e devolutiva de atividade — P1
### RF-063 — Biblioteca de materiais de apoio — P2
### RF-064 — Comunicados com segmentação de destinatários — P0
### RF-065 — Confirmação de leitura e reenvio aos não-leitores — P1
### RF-066 — Mensagens individuais conforme política institucional — P2
### RF-067 — Central de notificações e preferências por canal — P0
### RF-068 — Histórico de comunicações — P1

## 27.6 Calendário, documentos e financeiro

### RF-070 — Agenda pessoal consolidada por perfil — P1
### RF-071 — Gestão de eventos do calendário — P1
### RF-072 — Checklist de documentação obrigatória do aluno — P1
### RF-073 — Upload e organização de documentos — P1
### RF-074 — Emissão de documentos a partir de modelos — P1
### RF-075 — Solicitação de documentos pelo aluno/responsável — P2
### RF-076 — Verificação de autenticidade de documento emitido — P3
### RF-077 — Planos financeiros, cobranças e baixas — P2 `[pós-MVP]`
### RF-078 — Controle de inadimplência e régua de cobrança — P2 `[pós-MVP]`
### RF-079 — Descontos e bolsas com alçada de aprovação — P2 `[pós-MVP]`
### RF-080 — Extrato e comprovantes para o responsável — P2 `[pós-MVP]`

## 27.7 Visão, análise e governança

### RF-090 — Dashboard por perfil — P0
### RF-091 — Relatórios acadêmicos com filtros e exportação — P1
### RF-092 — Relatórios administrativos — P2
### RF-093 — Relatórios financeiros — P2 `[pós-MVP]`
### RF-094 — Indicadores e comparativos entre períodos — P2
### RF-095 — Busca global contextualizada — P1
### RF-096 — Listagens com filtros, ordenação, paginação e ações em lote — P0
### RF-097 — Trilha de auditoria consultável — P1
### RF-098 — Registro e atendimento de solicitações de titulares (LGPD) — P2
### RF-099 — Exportação de dados da instituição (portabilidade) — P2
### RF-100 — Configuração de alertas e critérios de risco — P2

---

# 28. Requisitos Não Funcionais

> Descrevem qualidade e comportamento esperados. Nenhuma tecnologia é escolhida aqui.

## 28.1 Segurança

| ID | Requisito |
| --- | --- |
| RNF-S01 | Toda operação verifica autenticação, vínculo ativo, papel e escopo antes de executar. |
| RNF-S02 | Dados devem ser protegidos em trânsito e em repouso. |
| RNF-S03 | Senhas armazenadas de forma irreversível; nunca exibidas ou enviadas em texto claro. |
| RNF-S04 | Bloqueio progressivo após tentativas de acesso malsucedidas. |
| RNF-S05 | Segundo fator disponível, obrigatório para perfis administrativos. |
| RNF-S06 | Arquivos enviados são validados quanto a tipo, tamanho e conteúdo malicioso. |
| RNF-S07 | Limites de requisição e de exportação para impedir extração massiva de dados. |
| RNF-S08 | Ambientes de teste não usam dados pessoais reais sem anonimização. |
| RNF-S09 | Acesso do suporte da plataforma é excepcional, temporário, justificado e auditado. |

## 28.2 Privacidade

| ID | Requisito |
| --- | --- |
| RNF-P01 | Coleta mínima: cada campo pessoal tem finalidade declarada. |
| RNF-P02 | Dados sensíveis exigem permissão específica e têm acesso registrado. |
| RNF-P03 | Consentimentos são versionados, datados e revogáveis. |
| RNF-P04 | Solicitações de titulares são registradas e respondidas dentro do prazo legal. |
| RNF-P05 | Estatísticas e comparativos usam dados anonimizados. |
| RNF-P06 | Prazos de retenção e eliminação definidos por tipo de dado. |
| RNF-P07 | O usuário sabe quais dados seus estão na plataforma e quem pode vê-los. |

## 28.3 Disponibilidade e confiabilidade

| ID | Requisito |
| --- | --- |
| RNF-D01 | Disponibilidade mínima de 99,5% em horário letivo (7h–22h, dias úteis). `[A VALIDAR]` |
| RNF-D02 | Janelas de manutenção fora do horário letivo, comunicadas com antecedência. |
| RNF-D03 | Cópias de segurança diárias, com teste periódico de restauração. |
| RNF-D04 | Falha em um módulo não impede o uso dos demais. |
| RNF-D05 | Operações críticas (fechamento, matrícula, lançamento) não podem gerar estado parcial. |
| RNF-D06 | Falha de rede preserva o conteúdo digitado e permite reenvio sem duplicar registros. |
| RNF-D07 | Plano de continuidade com objetivo de recuperação definido. `[A VALIDAR]` |

## 28.4 Desempenho

| ID | Requisito |
| --- | --- |
| RNF-De01 | Telas de uso frequente (dashboard, chamada, lista de turma) respondem em até 2s em condições normais. |
| RNF-De02 | Listagens grandes são paginadas e nunca carregam a base inteira. |
| RNF-De03 | Salvamento de chamada e de notas é percebido como imediato (feedback em até 1s). |
| RNF-De04 | Relatórios pesados são processados de forma assíncrona, com aviso ao ficarem prontos. |
| RNF-De05 | O produto é utilizável em conexões móveis instáveis e de baixa velocidade. |

## 28.5 Escalabilidade

| ID | Requisito |
| --- | --- |
| RNF-E01 | Suportar múltiplas instituições na mesma plataforma sem degradação perceptível. |
| RNF-E02 | Suportar instituições de 100 a 10.000 alunos com a mesma experiência. `[A VALIDAR]` |
| RNF-E03 | Suportar picos de acesso concentrados (divulgação de notas, matrícula, fim de período). |
| RNF-E04 | Crescimento funcional: novos módulos e perfis sem redesenho da navegação. |
| RNF-E05 | Configurações por instituição permitem atender modelos pedagógicos diferentes sem versões distintas do produto. |

## 28.6 Acessibilidade e usabilidade

| ID | Requisito |
| --- | --- |
| RNF-A01 | Conformidade com diretrizes de acessibilidade em nível AA. `[A VALIDAR]` |
| RNF-A02 | Navegação completa por teclado, com foco visível e ordem lógica. |
| RNF-A03 | Contraste adequado e informação nunca transmitida apenas por cor. |
| RNF-A04 | Compatibilidade com leitores de tela e uso de rótulos descritivos. |
| RNF-U01 | Tarefas frequentes em até 3 interações a partir do dashboard. |
| RNF-U02 | Mensagens de erro em linguagem clara, explicando causa e solução. |
| RNF-U03 | Vocabulário do domínio escolar, consistente em todo o produto. |
| RNF-U04 | Ajuda contextual e primeiros passos para novos usuários. |
| RNF-U05 | Um professor deve conseguir registrar a chamada de uma turma em menos de 60 segundos. |

## 28.7 Responsividade e multiplataforma

| ID | Requisito |
| --- | --- |
| RNF-R01 | Todas as funcionalidades essenciais utilizáveis em smartphone, tablet e desktop. |
| RNF-R02 | Sem rolagem horizontal indesejada em qualquer largura suportada. |
| RNF-R03 | Alvos de toque adequados e formulários otimizados para dispositivos móveis. |
| RNF-R04 | Versões imprimíveis legíveis para documentos e listas operacionais. |

## 28.8 Auditoria, manutenibilidade e operação

| ID | Requisito |
| --- | --- |
| RNF-Au01 | Operações sensíveis (seção 20) são registradas de forma imutável. |
| RNF-Au02 | Registros de auditoria são consultáveis com filtros e exportáveis sob permissão. |
| RNF-Au03 | Retenção da auditoria conforme política e legislação. |
| RNF-M01 | Regras de negócio configuráveis por instituição, sem intervenção técnica. |
| RNF-M02 | Terminologia, modelos de documento e mensagens ajustáveis por configuração. |
| RNF-M03 | Mudanças no produto não invalidam dados históricos já registrados. |
| RNF-M04 | Monitoramento de erros e de uso, sem expor dados pessoais desnecessariamente. |
| RNF-M05 | Migração inicial de dados de sistemas anteriores é um processo suportado, não improvisado. |
| RNF-C01 | Conformidade com a legislação educacional aplicável e com a LGPD. |
| RNF-C02 | Exportação completa dos dados da instituição a qualquer momento (portabilidade e saída). |

---

# 29. Regras de Negócio

## 29.1 Isolamento e acesso

| ID | Regra |
| --- | --- |
| RN-001 | Toda entidade de domínio pertence a exatamente uma instituição; consultas sem escopo de instituição são proibidas. |
| RN-002 | Uma instituição só visualiza seus próprios dados. |
| RN-003 | Um professor só acessa turmas e disciplinas às quais está vinculado no contexto ativo. |
| RN-004 | Um aluno só visualiza seus próprios dados acadêmicos. |
| RN-005 | Um responsável só visualiza os dados dos dependentes vinculados a ele. |
| RN-006 | Permissões pertencem ao vínculo, não à pessoa; papéis não se propagam entre instituições. |
| RN-007 | Encerrar ou suspender vínculo revoga acesso imediatamente e encerra sessões ativas. |
| RN-008 | Ausência de permissão é negação; não existe acesso implícito. |
| RN-009 | A visão consolidada multi-instituição exibe apenas metadados operacionais, nunca dados de alunos. |
| RN-010 | Uma instituição não enxerga os demais vínculos de uma pessoa. |

## 29.2 Estrutura acadêmica

| ID | Regra |
| --- | --- |
| RN-020 | Uma turma pertence a um único ano letivo, unidade, série e turno. |
| RN-021 | Períodos letivos não se sobrepõem e cobrem integralmente o ano letivo. |
| RN-022 | Apenas um ano letivo é o corrente por unidade. |
| RN-023 | Aula só pode ser registrada em dia letivo; fora dele, exige marcação de exceção e justificativa. |
| RN-024 | Oferta de disciplina exige ao menos um professor responsável para aceitar lançamentos. |
| RN-025 | Professor não pode ser alocado em dois compromissos simultâneos na mesma instituição. |
| RN-026 | Sala não pode receber duas turmas no mesmo horário. |
| RN-027 | Alterar a grade curricular de um ano em andamento não afeta lançamentos já realizados. |
| RN-028 | Estruturas com dependências não são excluídas; são encerradas, canceladas ou arquivadas. |
| RN-029 | Encerrar ano letivo exige todos os períodos fechados. |
| RN-030 | Dias letivos abaixo do mínimo legal geram alerta bloqueante para o encerramento do ano. `[A VALIDAR]` |

## 29.3 Matrícula e vida escolar

| ID | Regra |
| --- | --- |
| RN-040 | Um aluno não pode ter duas matrículas principais ativas no mesmo ano letivo e instituição. |
| RN-041 | Matrícula só pode ser vinculada a turma do mesmo ano letivo, série, turno e unidade. |
| RN-042 | Matrícula em turma sem vaga exige aprovação de gestor. |
| RN-043 | Pré-matrícula não confirmada no prazo expira automaticamente e libera a vaga. |
| RN-044 | Cancelamento e trancamento exigem motivo, data de efeito e tratamento das cobranças em aberto. |
| RN-045 | Transferência de saída exige apuração de notas e frequência até a data e emissão dos documentos. |
| RN-046 | Aluno transferido deixa de constar nos diários a partir da data de efeito, preservando os registros anteriores. |
| RN-047 | Troca de turma preserva notas e faltas; divergências de grade geram pendência para a coordenação. |
| RN-048 | Rematrícula segue o resultado final: aprovado avança de série, reprovado repete. |
| RN-049 | Aluno com matrícula não ativa não recebe lançamentos novos de nota ou frequência. |
| RN-050 | Aluno menor de idade deve ter ao menos um responsável legal vinculado. |

## 29.4 Notas, avaliação e frequência

| ID | Regra |
| --- | --- |
| RN-060 | Apenas o professor vinculado à oferta pode lançar notas e frequência, dentro do prazo. |
| RN-061 | Nota permanece invisível ao aluno enquanto estiver em rascunho. |
| RN-062 | Nota fora do intervalo configurado é rejeitada. |
| RN-063 | A soma dos pesos das avaliações de um período deve fechar o total configurado. |
| RN-064 | Fechar período exige ausência de pendências (aulas sem registro, alunos sem nota) ou justificativa registrada. |
| RN-065 | Após o fechamento, notas ficam travadas; alteração exige solicitação, aprovação e justificativa. |
| RN-066 | Toda alteração de nota preserva o valor anterior e é auditada. |
| RN-067 | Frequência abaixo do mínimo reprova, independentemente da média, salvo decisão do conselho registrada. |
| RN-068 | Falta justificada continua contando como ausência para o percentual, salvo abono explícito. `[A VALIDAR]` |
| RN-069 | Abono de falta exige permissão específica, motivo obrigatório e auditoria. |
| RN-070 | Edição de frequência após o prazo exige permissão especial e é auditada. |
| RN-071 | Aprovação pelo conselho é exceção registrada, com justificativa, autor e data. |
| RN-072 | Recuperação segue exclusivamente a fórmula configurada pela instituição; o cálculo é sempre explicável ao usuário. |
| RN-073 | Resultado final só é apurado com todos os períodos fechados. |
| RN-074 | Disciplina marcada como "não compõe média" não afeta o resultado final. |
| RN-075 | Aluno matriculado após o início do período tem a frequência calculada a partir da data de ingresso. |

## 29.5 Atividades, comunicação e documentos

| ID | Regra |
| --- | --- |
| RN-080 | Aluno só vê atividades publicadas das turmas em que está matriculado. |
| RN-081 | Entrega após o prazo só é aceita se a atividade permitir, e fica marcada como atrasada. |
| RN-082 | Atividade com entregas não pode ser excluída; apenas encerrada ou arquivada. |
| RN-083 | Comunicado publicado não é excluído; é retificado com nova versão e aviso. |
| RN-084 | Comunicado com confirmação obrigatória gera pendência até a leitura ser confirmada. |
| RN-085 | Envio em massa acima do limite configurado exige confirmação explícita. |
| RN-086 | Documento oficial só é emitido com dados acadêmicos consolidados. |
| RN-087 | Documento emitido é imutável; correção gera nova via com numeração e motivo. |
| RN-088 | Download de documento sensível é registrado. |
| RN-089 | Documentos e anexos herdam o escopo de permissão do registro de origem. |

## 29.6 Financeiro `[pós-MVP]`

| ID | Regra |
| --- | --- |
| RN-090 | Toda cobrança está vinculada a uma matrícula e a um responsável financeiro identificado. |
| RN-091 | Descontos e bolsas acima do limite exigem aprovação de alçada superior. |
| RN-092 | Baixas, estornos e renegociações são sempre auditados. |
| RN-093 | Bloqueio por inadimplência não impede o acesso a informações e documentos acadêmicos obrigatórios por lei. `[A VALIDAR]` |
| RN-094 | Cancelar matrícula exige decisão registrada sobre as cobranças em aberto. |
| RN-095 | Professores e alunos menores não acessam dados financeiros. |

## 29.7 Auditoria e dados pessoais

| ID | Regra |
| --- | --- |
| RN-100 | Toda operação da lista da seção 20.2 gera registro de auditoria imutável. |
| RN-101 | O acesso à trilha de auditoria é ele próprio auditado. |
| RN-102 | Dados acadêmicos não são excluídos enquanto houver obrigação legal de guarda. |
| RN-103 | Exportação de dados pessoais exige permissão específica e é registrada. |
| RN-104 | Solicitações de titulares são registradas com prazo e desfecho. |
| RN-105 | Dados sensíveis não aparecem em listagens gerais nem em exportações padrão. |

## 29.8 Conflitos e ambiguidades identificados

| # | Conflito | Encaminhamento |
| --- | --- | --- |
| C-01 | Professor com aulas simultâneas em instituições diferentes | O sistema não pode bloquear (são tenants distintos); deve alertar apenas o próprio docente. |
| C-02 | Bloqueio financeiro x direito de acesso ao dado acadêmico | Definir política com apoio jurídico; a recomendação é nunca bloquear boletim, histórico e declarações. |
| C-03 | Falta justificada abate ou não o percentual de frequência | Depende da rede/legislação; deve ser configurável. |
| C-04 | Visibilidade de notas parciais ao aluno antes do fechamento | Configurável por instituição; conflita com a prática de algumas escolas. |
| C-05 | Aluno maior de idade x acesso do responsável | Definir corte por maioridade e possibilidade de autorização expressa. |
| C-06 | Guarda compartilhada e restrição judicial de contato | Exige configuração por dependente e por responsável. |
| C-07 | Professor com vínculo encerrado x acesso ao que registrou | Recomenda-se somente-leitura por período limitado, configurável. |
| C-08 | Múltiplos papéis com permissões contraditórias | Regra proposta: união de concessões, com restrições explícitas prevalecendo. |
| C-09 | Aluno em duas instituições com o mesmo horário | Não bloquear; apenas sinalizar ao próprio aluno. |
| C-10 | Alteração de grade curricular no meio do ano | Permitida com permissão especial, sem afetar lançamentos existentes. |

---

# 30. Fluxos Principais

## 30.1 Gestão

### F-G01 — Criar e configurar a instituição
1. Instituição é provisionada na plataforma e o primeiro administrador recebe acesso.
2. Administrador completa os dados institucionais, o endereço e a identidade visual.
3. Cria as unidades (ou aceita a unidade única padrão).
4. Define segmentos, séries e cursos ofertados.
5. Configura o modelo de avaliação, a frequência mínima, os prazos e as políticas.
6. Cria os papéis adicionais necessários.
**Resultado:** instituição pronta para receber ano letivo e usuários.

### F-G02 — Configurar o ano letivo
1. Cria o ano letivo com data de início e fim.
2. Define os períodos letivos (quantidade, datas, pesos, prazos de lançamento e fechamento).
3. Monta o calendário acadêmico (feriados, recessos, eventos, conselhos).
4. Confere a contagem de dias letivos.
5. Marca o ano como corrente.
**Alternativo:** duplicar a configuração do ano anterior.

### F-G03 — Cadastrar professor
1. Convida o professor por e-mail, com papel, unidade e período de vínculo.
2. Professor aceita e completa/valida seus dados.
3. Gestor registra dados profissionais e disciplinas habilitadas.
**Alternativo:** professor já possui conta → apenas novo vínculo.

### F-G04 — Cadastrar aluno
1. Secretaria cadastra dados pessoais e complementares.
2. Vincula responsáveis, com papéis legal/financeiro/contato.
3. Anexa documentos e verifica o checklist.
**Alternativo:** importação em lote com validação prévia.

### F-G05 — Criar turma
1. Escolhe ano letivo, unidade, série, turno, capacidade e sala.
2. Sistema propõe as disciplinas da grade curricular.
3. Ajusta disciplinas e cargas horárias, se necessário.
4. Define o horário semanal.
5. Abre a turma para matrículas.

### F-G06 — Vincular professor à turma/disciplina
1. Abre a turma e a oferta de disciplina.
2. Seleciona o professor responsável (e auxiliares).
3. Sistema verifica conflitos de horário e habilitação.
4. Confirma → professor passa a ver a turma no seu portal e é notificado.

### F-G07 — Matricular aluno
Conforme 5.1 (fluxo detalhado).

### F-G08 — Acompanhar desempenho
1. Abre o dashboard e filtra por unidade, segmento e período.
2. Analisa indicadores de frequência, desempenho e pendências.
3. Clica em um indicador → lista detalhada (ex.: alunos em risco).
4. Aciona a coordenação, registra encaminhamento ou envia comunicado.
5. Exporta relatório quando necessário.

### F-G09 — Fechar o período letivo
1. Acompanha o painel de pendências por disciplina e professor.
2. Cobra pendências.
3. Fecha a turma quando todas as disciplinas estiverem fechadas.
4. Gera e publica os boletins.

### F-G10 — Encerrar o ano letivo e rematricular
1. Fecha o último período; apura resultados finais.
2. Realiza os conselhos de classe e registra as decisões.
3. Encerra o ano letivo (congela lançamentos).
4. Abre a rematrícula em lote com a progressão proposta.
5. Acompanha as confirmações e registra os não rematriculados.

## 30.2 Professor

### F-P01 — Acessar e escolher a instituição
1. Entra na plataforma.
2. Vê a agenda e as pendências consolidadas de todas as suas escolas.
3. Seleciona a instituição para trabalhar — ou clica direto em um item da agenda, que já leva ao
   contexto correto.

### F-P02 — Visualizar turmas
1. Acessa "Minhas turmas" no contexto ativo.
2. Filtra por ano letivo, turno e disciplina.
3. Abre a turma e vê alunos, diário, notas, atividades e desempenho.

### F-P03 — Registrar frequência
1. No dashboard, clica em "Fazer chamada" na aula do dia.
2. Lista abre com todos marcados como presentes.
3. Marca ausências e atrasos; registra o conteúdo da aula.
4. Salva → sistema confirma e atualiza a frequência.
**Alternativos:** aula não ocorrida (registra motivo); registro em atraso (dentro do prazo, normal;
fora do prazo, exige justificativa); aluno matriculado hoje (aparece a partir da data de efeito).

### F-P04 — Criar atividade
1. Escolhe turma e disciplina.
2. Preenche título, enunciado, anexos, prazo, valor e forma de entrega.
3. Salva como rascunho ou publica.
4. Publicação notifica os alunos e cria o prazo no calendário.

### F-P05 — Registrar notas
1. Cria (ou seleciona) a avaliação do período.
2. Abre a grade de lançamento da turma.
3. Lança as notas, com validação em tempo real.
4. Salva como rascunho; revisa; publica.
5. Sistema recalcula médias e notifica os alunos.

### F-P06 — Acompanhar alunos
1. Abre o painel de desempenho da turma.
2. Identifica alunos abaixo da média, com muitas faltas ou sem entregas.
3. Registra observação pedagógica ou envia comunicado.
4. Encaminha à coordenação quando necessário.

### F-P07 — Visualizar agenda
1. Abre a agenda consolidada.
2. Alterna entre dia, semana e mês.
3. Vê aulas, provas, entregas e reuniões de todas as instituições, identificadas por rótulo.
4. Clica em um item → entra no contexto correspondente.

### F-P08 — Fechar a disciplina no período
1. Recebe o aviso de prazo de fechamento.
2. Abre o painel de pendências da disciplina.
3. Resolve as pendências (aulas, notas).
4. Revisa a prévia e confirma o fechamento.

## 30.3 Aluno

### F-A01 — Acessar a plataforma
1. Recebe o convite/credencial e define a senha no primeiro acesso.
2. Entra e vê o dashboard do contexto ativo (ou escolhe a instituição, se houver mais de uma).

### F-A02 — Visualizar turma e disciplinas
1. Acessa "Minha turma".
2. Vê disciplinas, professores e desempenho resumido.

### F-A03 — Consultar horários
1. Abre a grade horária.
2. Alterna entre a visão do dia e a da semana.
3. Vê alterações de horário destacadas.

### F-A04 — Consultar notas
1. Abre "Notas".
2. Seleciona o período e a disciplina.
3. Vê as avaliações, os pesos, a média e a situação, com explicação do cálculo.
4. Baixa o boletim quando publicado.

### F-A05 — Consultar frequência
1. Abre "Frequência".
2. Vê o percentual por disciplina e as faltas por data.
3. Envia justificativa com anexo, se a escola permitir.

### F-A06 — Entregar atividade
1. Abre a atividade a partir do dashboard ou da lista.
2. Lê o enunciado e baixa os anexos.
3. Anexa o arquivo e/ou escreve a resposta.
4. Envia → recebe confirmação com data e hora.
5. Acompanha a correção e lê o feedback.
**Alternativos:** prazo encerrado (bloqueia ou marca como atrasada); reenvio antes do prazo; arquivo
acima do limite.

### F-A07 — Visualizar comunicados
1. Abre a caixa de comunicados.
2. Lê o comunicado e, quando exigido, confirma a leitura.
3. Consulta o histórico.

### F-A08 — Solicitar documento
1. Abre "Documentos" e escolhe o tipo.
2. Informa a finalidade e envia a solicitação.
3. Acompanha o status até a emissão e baixa o documento.

---

# 31. MVP

## 31.1 Critério

Entra no MVP o que é **indispensável para uma escola operar um período letivo inteiro dentro da
plataforma**: registrar quem estuda, quem ensina, o que aconteceu na aula, quanto o aluno tirou,
quanto faltou e o que a escola comunicou. O resto vem depois.

## 31.2 MVP

| Módulo | Escopo no MVP | Motivo |
| --- | --- | --- |
| Identidade e acesso | Login, primeiro acesso, recuperação, sessões | Sem isso não há produto |
| Multi-instituição | Vínculos, troca de contexto, isolamento | Conceito central do produto; caro de retroadaptar |
| Papéis e permissões | Papéis pré-definidos + escopo por instituição/unidade/turma | Segurança e privacidade não podem ser posteriores |
| Instituição | Cadastro, configurações essenciais, unidade única | Base de tudo |
| Ano e períodos letivos | Criação, datas, pesos, prazos | Estrutura temporal obrigatória |
| Calendário | Dias letivos, feriados, eventos básicos | Necessário para gerar aulas |
| Estrutura acadêmica | Séries, disciplinas, turmas, alocação de professores | Base operacional |
| Horários | Grade semanal simples com detecção de conflito | Necessária para o diário e a agenda |
| Alunos e responsáveis | Cadastro completo + vínculo do responsável (sem portal) | Matrícula depende disso |
| Professores | Cadastro e vínculo | Idem |
| Matrícula | Matrícula, cancelamento e transferência interna | Núcleo da vida escolar |
| Diário de classe | Aulas, conteúdo, frequência | Uso diário do professor |
| Frequência | Registro, justificativa, percentual, alertas básicos | Obrigação legal e indicador-chave |
| Avaliações e notas | Criação, lançamento, médias, publicação | Núcleo pedagógico |
| Fechamento de período | Pendências, fechamento, travamento | Fecha o ciclo do produto |
| Boletim | Geração e publicação | Entrega de valor visível |
| Comunicados | Envio segmentado e leitura | Substitui canais informais |
| Notificações | Central in-app + e-mail para eventos críticos | Sustenta os demais módulos |
| Dashboards | Um por perfil, com o essencial | Percepção de valor imediata |
| Portal do professor | Agenda, turmas, diário, notas, pendências | Uma das três vias |
| Portal do aluno | Dashboard, horário, notas, frequência, comunicados | Uma das três vias |
| Busca e listagens | Busca de aluno/turma, filtros, paginação | Usabilidade mínima |
| Auditoria | Registro das operações sensíveis + consulta básica | Confiança e conformidade |
| Importação inicial | Alunos, professores e matrículas por planilha | Sem isso, a adoção não acontece |

## 31.3 Pós-MVP

| Funcionalidade | Motivo de não estar no MVP |
| --- | --- |
| Portal do responsável | Alto valor, mas depende de comunicação e financeiro maduros |
| Atividades e entregas online | Valioso, mas a escola opera sem isso no primeiro ciclo |
| Materiais de apoio | Complementar às atividades |
| Recuperação e conselho de classe | Só necessários no fim do primeiro ano letivo |
| Histórico escolar completo e emissão de documentos por modelo | Depende de dados consolidados; no MVP, boletim e declaração simples bastam |
| Solicitação de documentos | Depende do módulo de documentos |
| Financeiro (planos, cobranças, inadimplência, descontos) | Módulo grande; nem toda instituição precisa |
| Relatórios avançados e indicadores comparativos | Requer massa de dados histórica |
| Múltiplas unidades com calendários e regras distintas | Necessário só para redes |
| Papéis customizados | Papéis pré-definidos cobrem o início |
| Confirmação de leitura com reenvio automático e mensagens individuais | Refinamento da comunicação |
| Ocorrências e acompanhamento pedagógico | Depende de maturidade de uso |
| Rematrícula em lote | Só no fim do primeiro ano letivo |
| Chamada com uso offline e aplicativo instalável | Otimização importante, não bloqueante |
| Exportação/assinatura de calendário externo | Conveniência |

## 31.4 Futuro

| Funcionalidade | Justificativa estratégica |
| --- | --- |
| Predição de risco de reprovação e evasão | Diferencial competitivo baseado no acervo de dados |
| Avaliação por competências e habilidades (BNCC) | Alinhamento curricular; exige modelo próprio |
| Visão de rede/mantenedora com comparativo entre unidades | Atende redes maiores |
| Integrações externas (censo escolar, sistemas públicos, meios de pagamento, nota fiscal) | Reduz retrabalho, depende de parceiros |
| Aplicativos nativos para professor e aluno | Experiência móvel superior |
| Assinatura eletrônica e verificação pública de documentos | Reduz burocracia |
| Banco de questões e geração de avaliações | Produtividade docente |
| Trilhas de recuperação e conteúdo adaptativo | Evolução pedagógica |
| Biblioteca, transporte, merenda, portaria e catraca | Expansão operacional |
| Marketplace de conteúdos e integrações de terceiros | Modelo de plataforma |
| Ensino superior e cursos por crédito | Novo segmento de mercado |

---

# 32. Backlog Inicial

| ID | Funcionalidade | Perfil | Prioridade | Fase | Dependências |
| --- | --- | --- | --- | --- | --- |
| B-001 | Autenticação e primeiro acesso | Todos | P0 | MVP | — |
| B-002 | Recuperação de acesso e gestão de sessões | Todos | P0 | MVP | B-001 |
| B-003 | Modelo de vínculo pessoa↔instituição | Todos | P0 | MVP | B-001 |
| B-004 | Seleção e troca de contexto de instituição | Todos | P0 | MVP | B-003 |
| B-005 | Papéis pré-definidos e verificação de permissão por escopo | Todos | P0 | MVP | B-003 |
| B-006 | Convite e vinculação de usuários | Gestão | P0 | MVP | B-003, B-005 |
| B-007 | Encerramento/suspensão de vínculo | Gestão | P0 | MVP | B-003 |
| B-008 | Cadastro e configurações da instituição | Gestão | P0 | MVP | B-005 |
| B-009 | Ano letivo e períodos letivos | Gestão | P0 | MVP | B-008 |
| B-010 | Calendário acadêmico e dias letivos | Gestão | P0 | MVP | B-009 |
| B-011 | Séries, segmentos e catálogo de disciplinas | Gestão | P0 | MVP | B-008 |
| B-012 | Grade curricular por série | Gestão | P1 | MVP | B-011 |
| B-013 | Cadastro de professores | Gestão | P0 | MVP | B-006 |
| B-014 | Cadastro de alunos e responsáveis | Gestão | P0 | MVP | B-008 |
| B-015 | Criação e gestão de turmas | Gestão | P0 | MVP | B-009, B-011 |
| B-016 | Alocação de professores nas disciplinas da turma | Gestão | P0 | MVP | B-013, B-015 |
| B-017 | Grade de horários com detecção de conflitos | Gestão | P1 | MVP | B-016 |
| B-018 | Matrícula de aluno | Gestão | P0 | MVP | B-014, B-015 |
| B-019 | Transferência interna de turma | Gestão | P1 | MVP | B-018 |
| B-020 | Cancelamento/trancamento de matrícula | Gestão | P1 | MVP | B-018 |
| B-021 | Importação em lote de alunos, professores e matrículas | Gestão | P1 | MVP | B-013, B-014, B-018 |
| B-022 | Geração automática das aulas do diário | Sistema | P0 | MVP | B-010, B-017 |
| B-023 | Diário de classe: conteúdo da aula | Professor | P0 | MVP | B-022 |
| B-024 | Registro de frequência | Professor | P0 | MVP | B-022, B-018 |
| B-025 | Justificativa e abono de faltas | Gestão/Professor | P1 | MVP | B-024 |
| B-026 | Cálculo de percentual de frequência e alertas | Sistema | P1 | MVP | B-024 |
| B-027 | Criação de avaliações com peso | Professor | P0 | MVP | B-016, B-009 |
| B-028 | Lançamento e publicação de notas | Professor | P0 | MVP | B-027, B-018 |
| B-029 | Cálculo de médias e situação por disciplina | Sistema | P0 | MVP | B-028, B-026 |
| B-030 | Fechamento de período com validação de pendências | Gestão/Professor | P0 | MVP | B-029 |
| B-031 | Geração e publicação do boletim | Sistema | P0 | MVP | B-030 |
| B-032 | Reabertura e alteração de nota fechada com aprovação | Gestão | P1 | MVP | B-030, B-045 |
| B-033 | Comunicados com segmentação de destinatários | Gestão/Professor | P0 | MVP | B-005 |
| B-034 | Central de notificações in-app e por e-mail | Todos | P0 | MVP | B-001 |
| B-035 | Dashboard da gestão | Gestão | P0 | MVP | B-018, B-024, B-029 |
| B-036 | Dashboard e agenda do professor | Professor | P0 | MVP | B-022, B-028 |
| B-037 | Dashboard do aluno | Aluno | P0 | MVP | B-028, B-024, B-033 |
| B-038 | Portal do aluno: notas, frequência, horário, comunicados | Aluno | P0 | MVP | B-037 |
| B-039 | Visão consolidada multi-instituição do professor | Professor | P1 | MVP | B-004, B-036 |
| B-040 | Listagens com filtros, ordenação, paginação e ações em lote | Todos | P0 | MVP | — |
| B-041 | Busca global contextualizada | Todos | P1 | MVP | B-040 |
| B-042 | Ficha completa do aluno | Gestão | P0 | MVP | B-014, B-018 |
| B-043 | Estados vazios, de carregamento e de erro padronizados | Todos | P0 | MVP | — |
| B-044 | Acessibilidade e responsividade das telas do MVP | Todos | P0 | MVP | — |
| B-045 | Trilha de auditoria das operações sensíveis | Gestão | P0 | MVP | B-005 |
| B-046 | Consulta e exportação da auditoria | Gestão | P1 | MVP | B-045 |
| B-047 | Emissão de declaração de matrícula e de frequência | Gestão | P1 | MVP | B-018, B-026 |
| B-048 | Checklist de documentação obrigatória | Gestão | P1 | Pós-MVP | B-014 |
| B-049 | Upload e organização de documentos | Gestão | P1 | Pós-MVP | B-048 |
| B-050 | Emissão de documentos por modelo configurável | Gestão | P1 | Pós-MVP | B-049 |
| B-051 | Solicitação de documentos pelo aluno | Aluno | P2 | Pós-MVP | B-050 |
| B-052 | Histórico escolar consolidado | Gestão | P1 | Pós-MVP | B-030, B-056 |
| B-053 | Criação, entrega e correção de atividades | Professor/Aluno | P1 | Pós-MVP | B-016, B-018 |
| B-054 | Biblioteca de materiais de apoio | Professor/Aluno | P2 | Pós-MVP | B-016 |
| B-055 | Recuperação paralela e final | Professor/Gestão | P1 | Pós-MVP | B-029 |
| B-056 | Apuração de resultado final e progressão | Sistema | P1 | Pós-MVP | B-055, B-026 |
| B-057 | Conselho de classe e ata | Gestão | P2 | Pós-MVP | B-056 |
| B-058 | Rematrícula em lote | Gestão | P1 | Pós-MVP | B-056 |
| B-059 | Transferência de saída com documentos | Gestão | P1 | Pós-MVP | B-050, B-052 |
| B-060 | Confirmação de leitura e reenvio aos não-leitores | Gestão | P1 | Pós-MVP | B-033 |
| B-061 | Mensagens individuais com política institucional | Todos | P2 | Pós-MVP | B-033 |
| B-062 | Agenda e calendário completos por perfil | Todos | P1 | Pós-MVP | B-010, B-017 |
| B-063 | Papéis customizados e permissões granulares | Gestão | P1 | Pós-MVP | B-005 |
| B-064 | Múltiplas unidades com escopo de permissão | Gestão | P1 | Pós-MVP | B-008, B-063 |
| B-065 | Ocorrências pedagógicas e disciplinares | Gestão/Professor | P2 | Pós-MVP | B-042 |
| B-066 | Critérios configuráveis de risco e lista de atenção | Gestão | P2 | Pós-MVP | B-029, B-026 |
| B-067 | Relatórios acadêmicos com exportação | Gestão | P1 | Pós-MVP | B-029, B-026 |
| B-068 | Relatórios administrativos | Gestão | P2 | Pós-MVP | B-067 |
| B-069 | Portal do responsável | Responsável | P1 | Pós-MVP | B-014, B-038 |
| B-070 | Justificativa de falta pelo aluno/responsável | Aluno/Responsável | P2 | Pós-MVP | B-025, B-069 |
| B-071 | Planos financeiros, cobranças e baixas | Financeiro | P2 | Pós-MVP | B-018 |
| B-072 | Inadimplência e régua de cobrança | Financeiro | P2 | Pós-MVP | B-071 |
| B-073 | Descontos e bolsas com alçada | Financeiro | P2 | Pós-MVP | B-071 |
| B-074 | Extrato e comprovantes para o responsável | Responsável | P2 | Pós-MVP | B-071, B-069 |
| B-075 | Relatórios financeiros | Financeiro | P2 | Pós-MVP | B-071 |
| B-076 | Preferências de notificação por canal e tipo | Todos | P2 | Pós-MVP | B-034 |
| B-077 | Relatórios recorrentes agendados | Gestão | P3 | Pós-MVP | B-067 |
| B-078 | Chamada com uso offline e sincronização | Professor | P2 | Pós-MVP | B-024 |
| B-079 | Instalação como aplicativo e notificações push | Todos | P2 | Pós-MVP | B-034 |
| B-080 | Exportação/assinatura de calendário externo | Professor/Aluno | P3 | Pós-MVP | B-062 |
| B-081 | Fluxo de solicitações de titulares (LGPD) | Gestão | P2 | Pós-MVP | B-045 |
| B-082 | Exportação completa dos dados da instituição | Gestão | P2 | Pós-MVP | B-045 |
| B-083 | Retenção e eliminação de dados por política | Sistema | P3 | Pós-MVP | B-081 |
| B-084 | Segundo fator de autenticação | Todos | P1 | Pós-MVP | B-001 |
| B-085 | Verificação pública de autenticidade de documentos | Externo | P3 | Futuro | B-050 |
| B-086 | Avaliação por competências e habilidades | Professor | P3 | Futuro | B-028 |
| B-087 | Visão consolidada de rede/mantenedora | Rede | P2 | Futuro | B-064, B-067 |
| B-088 | Predição de risco de reprovação e evasão | Gestão | P3 | Futuro | B-066, B-067 |
| B-089 | Plano de acompanhamento e intervenção pedagógica | Coordenação | P2 | Futuro | B-065, B-066 |
| B-090 | Integração com meios de pagamento e conciliação | Financeiro | P2 | Futuro | B-071 |
| B-091 | Emissão de nota fiscal de serviço | Financeiro | P3 | Futuro | B-071 |
| B-092 | Integração com sistemas públicos e censo escolar | Gestão | P2 | Futuro | B-052 |
| B-093 | Banco de questões e geração de avaliações | Professor | P3 | Futuro | B-027 |
| B-094 | Aplicativos nativos para professor e aluno | Professor/Aluno | P3 | Futuro | B-079 |
| B-095 | Módulos operacionais (biblioteca, transporte, merenda, portaria) | Gestão | P3 | Futuro | B-008 |
| B-096 | Suporte a cursos por crédito e ensino superior | Gestão | P3 | Futuro | B-011, B-018 |

---

# 33. Lacunas e Questões em Aberto

> Estas perguntas dependem de decisão do negócio, do jurídico ou da rede de ensino atendida. Não
> foram respondidas aqui de propósito.

## 33.1 Escopo e mercado

| # | Questão |
| --- | --- |
| Q-01 | Quais tipos de instituição o produto atenderá no lançamento: pública, privada ou ambas? |
| Q-02 | Quais níveis de ensino estão no escopo inicial (Infantil, Fundamental I e II, Médio, Técnico, EJA)? |
| Q-03 | O produto atenderá redes com múltiplas unidades já no início, ou apenas escolas isoladas? |
| Q-04 | Qual o porte-alvo (nº de alunos) da primeira leva de clientes? |
| Q-05 | Há uma escola-piloto definida cujas regras devem ser atendidas primeiro? |

## 33.2 Modelo acadêmico

| # | Questão |
| --- | --- |
| Q-06 | Qual o modelo de avaliação padrão: numérico, conceitual, parecer, misto ou por competências? |
| Q-07 | Quantos períodos letivos e com quais pesos? A média anual é simples ou ponderada? |
| Q-08 | Qual a regra exata de aprovação (média mínima, frequência mínima, arredondamento)? |
| Q-09 | Como funciona a recuperação: paralela, final, ambas? Qual a fórmula? Substitui, faz média ou vale a maior? |
| Q-10 | Existe progressão parcial / dependência? Quantas disciplinas são permitidas? |
| Q-11 | A frequência é por aula/disciplina ou por dia/turno? Varia por segmento? |
| Q-12 | Falta justificada abate o percentual de frequência? Em quais casos há abono legal? |
| Q-13 | O conselho de classe pode aprovar aluno reprovado por frequência? Com qual formalidade? |
| Q-14 | Notas parciais ficam visíveis ao aluno antes do fechamento? |
| Q-15 | Como tratar alunos com necessidades específicas: adaptação curricular, avaliação diferenciada, terminalidade? |

## 33.3 Perfis, permissões e responsáveis

| # | Questão |
| --- | --- |
| Q-16 | O portal do responsável entra no roadmap de curto prazo? Em qual fase? |
| Q-17 | Qual a política de comunicação: professor fala diretamente com aluno? Com responsável? Aluno pode iniciar conversa? |
| Q-18 | Aluno maior de idade: o responsável continua com acesso? Depende de autorização? |
| Q-19 | Como tratar guarda compartilhada, restrição judicial e responsáveis com direitos diferentes? |
| Q-20 | Professor com vínculo encerrado mantém acesso somente-leitura ao que registrou? Por quanto tempo? |
| Q-21 | Papéis customizados são necessários no MVP ou os pré-definidos bastam? |
| Q-22 | Quem, na prática, tem alçada para alterar nota fechada e abonar falta? |

## 33.4 Financeiro

| # | Questão |
| --- | --- |
| Q-23 | O financeiro entra no produto ou a escola continua usando sistema próprio? |
| Q-24 | Se entrar: apenas controle de cobranças ou integração com pagamento e emissão fiscal? |
| Q-25 | Qual a política de bloqueio por inadimplência, e o que o jurídico permite bloquear? |
| Q-26 | Como funcionam bolsas e convênios (origem, critérios de manutenção, renovação)? |
| Q-27 | O contrato de prestação de serviços será gerado e assinado na plataforma? |

## 33.5 Documentos e obrigações legais

| # | Questão |
| --- | --- |
| Q-28 | Quais documentos precisam ser emitidos com validade legal, e com qual modelo e numeração? |
| Q-29 | É necessária assinatura eletrônica? Qual o padrão exigido? |
| Q-30 | Quais são os prazos legais de guarda dos documentos e registros acadêmicos? |
| Q-31 | Há obrigação de exportar dados para censo escolar ou sistemas da rede pública? Em qual formato? |
| Q-32 | Quais relatórios são exigidos por órgãos reguladores? |

## 33.6 Integrações e migração

| # | Questão |
| --- | --- |
| Q-33 | Existem sistemas atuais dos quais os dados precisarão ser migrados? Em qual formato? |
| Q-34 | Há necessidade de integração com plataformas de conteúdo, sala de aula virtual ou videoconferência? |
| Q-35 | Haverá integração com catraca, biometria ou controle de acesso físico? |
| Q-36 | Que canais de comunicação além de e-mail e push são exigidos (SMS, mensageria)? |

## 33.7 Operação e produto

| # | Questão |
| --- | --- |
| Q-37 | Como uma nova instituição é criada: autoatendimento, comercial ou provisionamento interno? |
| Q-38 | Qual o modelo de cobrança do produto (por aluno, por instituição, por módulo)? |
| Q-39 | Qual o nível de disponibilidade contratado e a janela de manutenção aceitável? |
| Q-40 | Qual a política de suporte e o nível de acesso do time de suporte aos dados da escola? |
| Q-41 | Haverá ambiente de demonstração/treinamento com dados fictícios? |
| Q-42 | Quem é o controlador dos dados pessoais: a instituição, a plataforma, ou ambos em papéis distintos? |
| Q-43 | Qual o idioma e a abrangência geográfica no lançamento? |
| Q-44 | Existe identidade de marca definida (nome, logo, paleta) para o Integra Edu? |

---

# 34. Premissas

## 34.1 O que foi informado `[INFORMADO]`

1. O produto se chama **Integra Edu** e é uma plataforma multiplataforma de gestão escolar.
2. Existem **três vias iniciais**: Instituição/Gestão, Professor e Aluno.
3. A via da instituição atende diretores, gestores, coordenadores, secretários e demais
   profissionais administrativos.
4. Um professor pode atuar em **mais de uma instituição** e precisa de visão centralizada, sem
   sistemas separados.
5. O aluno precisa acompanhar disciplinas, horários, notas, frequência, atividades, comunicados,
   calendário e documentos.
6. A interface deve transmitir modernização, organização, controle, transparência, segurança,
   simplicidade, eficiência, integração e gestão baseada em informações.
7. Cada instituição precisa ter seus próprios dados, configurações e permissões.
8. Um professor vinculado a várias instituições não pode ver dados de instituição na qual não tem
   permissão.
9. Nesta fase não se define tecnologia, arquitetura, banco de dados nem implementação.
10. LGPD e privacidade devem ser considerados desde o levantamento.

## 34.2 O que foi inferido `[INFERIDO]`

1. O público inicial é a **educação básica brasileira** (Infantil, Fundamental, Médio), pela
   terminologia usada (turmas, séries, boletim, diário de classe, responsáveis).
2. O contexto é **Brasil**, com português do Brasil, calendário anual e legislação educacional
   brasileira.
3. A instituição é a **fronteira de isolamento de dados**; a plataforma serve várias instituições.
4. O ano letivo é anual e dividido em períodos (bimestres/trimestres).
5. A escola já possui uma base de alunos e professores a ser migrada — daí a necessidade de
   importação em lote.
6. Existe expectativa de uso móvel intenso por professores e alunos.
7. O financeiro é relevante para parte do público (escolas privadas), não para todo ele.
8. O responsável é figura obrigatória no cadastro do aluno menor, mesmo sem portal próprio.

## 34.3 Recomendações do levantamento `[RECOMENDAÇÃO]`

1. Criar o **perfil de responsável** como evolução pós-MVP, mantendo o vínculo cadastral desde o
   MVP.
2. Tornar o **financeiro um módulo ativável**, não obrigatório.
3. Adotar **modelo de avaliação configurável por segmento**, em vez de fixar um único modelo.
4. Prever perfis adicionais: mantenedora/rede, auxiliar de sala, orientador educacional e suporte da
   plataforma com acesso auditado.
5. Registrar auditoria de operações sensíveis **desde o MVP** — é caro de acrescentar depois.
6. Tratar o **isolamento entre instituições** como critério de aceite testável de cada módulo.
7. Priorizar a **redução do tempo de chamada e de lançamento de notas** como métrica de produto.
8. Manter **explicabilidade do cálculo** de médias e frequência visível ao usuário.
9. Prever **importação e exportação completas** desde o início, para adoção e portabilidade.
10. Evitar rankings nominais entre alunos; usar comparativos anônimos e configuráveis.
11. Preparar o modelo de dados de negócio para múltiplas unidades desde o começo, mesmo que a
    interface só exponha isso depois.

## 34.4 O que precisa ser validado `[A VALIDAR]`

Todos os itens da seção 33, além de:

1. Regras exatas de aprovação, recuperação, dependência e frequência mínima.
2. Política de bloqueio por inadimplência e seus limites legais.
3. Política de comunicação entre perfis e tratamento de menores.
4. Prazos legais de guarda e retenção de dados e documentos.
5. Nível de disponibilidade, desempenho e acessibilidade contratados.
6. Necessidade de assinatura eletrônica e verificação de autenticidade.
7. Formato e obrigatoriedade das exportações para órgãos públicos.
8. Definição do controlador e do operador de dados pessoais.
9. Escopo da primeira instituição-piloto e suas particularidades.
10. Terminologia oficial do produto (nomes de menus e entidades) com a equipe pedagógica.

---

## Anexo A — Checklist de revisão do levantamento

| Item revisado | Situação |
| --- | --- |
| Funcionalidades ausentes | Acrescentados: conselho de classe, ocorrências, dependência/progressão parcial, salas e ambientes, importação em lote, checklist documental, delegação temporária, retenção de dados, exportação/portabilidade, plano de intervenção pedagógica |
| Perfis ausentes | Acrescentados: responsável, mantenedora/rede, auxiliar de sala, orientador educacional, suporte da plataforma, egresso |
| Regras de negócio não consideradas | Acrescentadas: unicidade de matrícula, frequência a partir da data de ingresso, disciplina que não compõe média, imutabilidade de documento emitido, retificação de comunicado |
| Dependências | Mapeadas na coluna "Dependências" do backlog (seção 32) |
| Fluxos incompletos | Acrescentados: fechamento de período, encerramento de ano letivo, rematrícula, transferência interna, fechamento de disciplina pelo professor |
| Casos excepcionais | Tratados: aluno que entra no meio do período, professor substituto, aula não ocorrida, reabertura de período, turma cancelada, vínculo expirado, conflito entre instituições |
| Problemas de permissão | Consolidados em cenários de teste obrigatórios (18.3) e conflitos identificados (29.8) |
| Necessidades de auditoria | Catálogo completo na seção 20.2 |
| Necessidades de comunicação | Módulo detalhado na seção 8 e catálogo de notificações na 17.2 |
| Pontos de expansão futura | Consolidados nas seções 31.4 e 32 |

---

*Documento elaborado como levantamento inicial de requisitos. Sujeito a revisão após validação das
questões em aberto (seção 33) com a equipe de negócio, a coordenação pedagógica e o jurídico.*
