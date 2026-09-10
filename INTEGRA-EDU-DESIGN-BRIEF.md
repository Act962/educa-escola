# Integra Edu — Instruções para geração de layout/mockups no Claude Design

Guia resumido para pedir e revisar telas do Integra Edu no Claude Design.
Regra do projeto: **leiaute aprovado antes de escrever código.**

---

## 1. Como pedir

Sempre nesta ordem:

1. **Perfil** — Gestão, Professor ou Aluno.
2. **Tela(s)** — uma por artboard, nomeadas (ex.: `Professor / Chamada`).
3. **Dispositivo** — Desktop 1440×1024, Tablet 834×1194 ou Mobile 390×844.
4. **Estado** — padrão, vazio, carregando, erro, sucesso.
5. **Dados de exemplo** — nomes, turmas e números plausíveis em português do Brasil.

> Um pedido = um fluxo. Vários fluxos no mesmo canvas viram ruído.

**Modelo de prompt**

```
Crie um canvas com as telas do [PERFIL] do Integra Edu:
1. [Tela A] — desktop, estado padrão
2. [Tela A] — mobile, estado padrão
3. [Tela A] — estado vazio
Base: INTEGRA-EDU-REQUISITOS.md, seções [X] e [Y].
Use os tokens e componentes do design system do projeto.
```

---

## 2. Design system (obrigatório)

- Base visual: **shadcn/ui + Tailwind**, espelhando `packages/ui/src/styles/globals.css`.
- Use apenas tokens semânticos: `background`, `foreground`, `card`, `muted`,
  `primary`, `secondary`, `destructive`, `border`, `ring`.
- Raio, sombra e espaçamento vindos do tema; nada de valor solto.
- Tipografia: uma família, 4 tamanhos no máximo por tela.
- Escala de espaçamento em múltiplos de 4.
- Cores semânticas de estado: sucesso, atenção, erro, informativo — nunca cor
  como única forma de informação.
- Claro e escuro precisam funcionar; não fixar cor fora do token.

**Componentes preferenciais:** Card, Table, DataTable com filtros, Badge, Tabs,
Sheet, Dialog, Select, Combobox, Calendar, Avatar, Skeleton, Toast, Breadcrumb,
Command (busca global).

---

## 3. Estrutura padrão de tela

```
┌─ Barra de contexto: logo da escola · seletor de instituição · ano letivo · período ─┐
├─ Navegação lateral (desktop) / inferior (mobile)                                     │
├─ Cabeçalho: título + breadcrumb + ações primárias (máx. 2)                           │
├─ Conteúdo: o essencial acima da dobra                                                │
└─ Rodapé de ação em formulários longos (salvar/cancelar fixos)                        │
```

Regras:

- **Contexto sempre visível** — instituição, unidade e ano letivo.
- Uma ação primária por tela; as demais são secundárias ou ficam em menu.
- Tabela densa só em Gestão/desktop; em mobile vira lista de cards.
- Sem rolagem horizontal; conteúdo largo rola dentro do próprio contêiner.

---

## 4. Telas mínimas por perfil

**Gestão** — Dashboard executivo · Lista de alunos com filtros · Ficha do aluno ·
Matrícula (formulário em etapas) · Turmas · Detalhe da turma · Grade de horários ·
Fechamento de período · Comunicados · Relatórios.

**Professor** — Dashboard com aulas do dia · Chamada · Diário de aula ·
Lançamento de notas (grade tipo planilha) · Atividades e correção · Turma e alunos ·
Agenda consolidada multi-instituição · Central de pendências.

**Aluno** — Dashboard · Grade horária · Notas e boletim · Frequência ·
Atividades e entrega · Comunicados · Documentos.

---

## 5. Estados obrigatórios em cada tela

| Estado | O que mostrar |
| --- | --- |
| Vazio | Ícone, frase explicativa e ação sugerida ("Nenhuma turma criada — criar turma") |
| Carregando | Skeleton com a forma do conteúdo, nunca spinner de tela cheia |
| Erro | Causa em linguagem simples + como resolver + preservar o que foi digitado |
| Sucesso | Toast discreto, com desfazer quando a ação permitir |
| Sem permissão | Explicar o motivo, sem revelar a existência do dado |

---

## 6. Prioridades por dispositivo

| Perfil | Desktop | Mobile |
| --- | --- | --- |
| Gestão | Tabelas, cadastros, relatórios, ações em lote | Dashboard, alertas, busca de aluno, aprovações |
| Professor | Notas em grade, criação de avaliações, correção | Chamada, agenda do dia, pendências |
| Aluno | Consulta ampla, entrega de trabalhos | Horário, notas, frequência, prazos, comunicados |

Meta de usabilidade a refletir no leiaute: **chamada de uma turma em menos de 60 segundos**
e tarefas frequentes em até 3 interações a partir do dashboard.

---

## 7. Conteúdo dos mockups

- Textos reais em **português do Brasil**, com o vocabulário da escola
  (turma, série, boletim, diário, frequência) — nada de "Lorem ipsum".
- Nomes fictícios plausíveis; nunca dados de pessoas reais.
- Números coerentes entre si (média, faltas, percentual de frequência).
- Nada de dado sensível visível em listagem (laudo, saúde, financeiro do aluno).

---

## 8. Acessibilidade — checklist do leiaute

- [ ] Contraste AA em texto e componentes
- [ ] Foco visível e ordem de tabulação lógica
- [ ] Alvo de toque confortável em mobile
- [ ] Informação nunca apenas por cor
- [ ] Rótulo visível em todo campo (placeholder não é rótulo)
- [ ] Hierarquia de títulos coerente

---

## 9. Revisão antes de virar código

1. O contexto (escola/ano/período) está claro na tela?
2. A ação principal é óbvia em menos de 3 segundos?
3. Os cinco estados foram desenhados?
4. Funciona em mobile sem perder função essencial?
5. Usa apenas tokens e componentes do design system?
6. Respeita as permissões do perfil (nada exibido fora do escopo)?
7. Aprovado pelo usuário? — **só então** implementar, buildar e publicar.

---

**Referência:** `INTEGRA-EDU-REQUISITOS.md` (seções 6, 7, 16, 22 e 23) e
`packages/ui/src/styles/globals.css`.
