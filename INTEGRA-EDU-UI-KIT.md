# Integra Edu — do mockup ao código sem perder fidelidade

Guia curto para transformar o canvas do Professor em interface real no
`educa-escola`, sem que a tela nasça "parecida" e vá se afastando a cada PR.

O que faz a fidelidade se perder, na prática, é sempre a mesma coisa: alguém
escreve `#2E93C9` direto no componente, outro arredonda `22px` para `rounded-2xl`,
um terceiro usa `text-sm` onde era 13px. A defesa é ter **um lugar só** onde
esses valores existem — e um teste que reprova quem escapar dele.

---

## 1. Ordem de trabalho

```
canvas (aprovado)  →  tokens  →  primitivos em packages/ui  →  telas em apps/web
                                        ↑                             ↓
                                        └──── comparação com o PNG ────┘
```

Nunca comece pela tela. Uma tela construída antes dos primitivos vira um monte
de `div` com estilo inline — que é exatamente o que o mockup é, e o que o código
não pode ser.

---

## 2. Congele a referência dentro do repositório

O canvas é editável e vai mudar. O que o código persegue precisa ser imutável:

1. No canvas, **Export → PNG** de cada prancha (Dashboard, Chamada, Notas,
   Chamada mobile, Estados).
2. Guarde em `docs/design/professor/*.png` e commite.
3. Anote no `CLAUDE.md`, na seção do produto, o link do canvas e a pasta dos PNGs
   — é o que faz qualquer pessoa (ou agente) achar a referência sem perguntar.

Toda vez que o canvas mudar, reexporte e commite junto com o PR que aplica a
mudança. PNG desatualizado é pior que PNG nenhum.

---

## 3. Tokens primeiro

O arquivo `integra-tokens.css` que acompanha este guia entra em
`packages/ui/src/styles/`, importado por `globals.css` logo após os `@import` do
Tailwind/shadcn — e o bloco `:root` neutro do scaffold sai.

Ele traz três coisas:

- a **paleta bruta** (`--ie-*`), convertida do mockup para oklch;
- os **tokens shadcn** (`--primary`, `--card`, `--muted-foreground`…) redefinidos
  em cima dela, para os primitivos já existentes saírem certos de graça;
- **raios e semânticos de estado** (`--radius-card`, `--color-success`…).

Uma decisão que vale registrar: `--radius` continua em `0.625rem`. A escala do
shadcn então produz `xl = 14px` e `3xl = 22px`, que são exatamente os raios do
mockup. Não mexa em `--radius` sem refazer as contas.

### Fonte

O mockup usa **Plus Jakarta Sans**. Substitui `Inter Variable` no `@theme inline`.
Carregue como fonte local (`packages/ui/src/assets/fonts/`) e não por CDN — o app
precisa funcionar sem rede externa, e a métrica de fallback muda o layout.

---

## 4. A escala real (o mockup tem meios-pixels; o código não deve ter)

Desenhei no olho, então existem `12.5px`, `13.5px`, `15.5px`. Isso não vai para o
código. A ramp convergida, que preserva a hierarquia sem a bagunça:

| Uso | Tamanho | Peso | Tailwind |
| --- | --- | --- | --- |
| Rótulo caixa-alta (`INSTITUIÇÃO`, `ALUNO`) | 10px, tracking 0.7px | 700 | `text-[10px] tracking-[0.7px]` |
| Metadado, legenda | 11px | 500–600 | `text-[11px]` |
| Badge, chip, texto auxiliar | 12px | 600–700 | `text-xs` |
| Corpo, item de navegação | 13px | 500–700 | `text-[13px]` |
| Título de linha, título de card lateral | 14px | 700–800 | `text-sm` |
| Título de card | 16px | 800, tracking -0.2px | `text-base` |
| Título de seção / saudação | 20px | 800, tracking -0.4px | `text-xl` |
| Título de página | 24px | 800, tracking -0.6px | `text-2xl` |

Espaçamento: múltiplos de 4. `gap-2` (8) entre itens de lista, `gap-3` (12) dentro
de linha, `gap-4` (16) entre cards, `p-6` (24) de padding de card, `p-3` (12) em
linha de lista.

Raios: card `rounded-card` (22), casca do app `rounded-shell` (24), botão/input/
caixa de ícone `rounded-control` (14), célula de nota e chip `rounded-field` (11),
badge `rounded-full`.

**Sombra: nenhuma.** A separação vem do fundo azul (`--background`) contra o card
branco. Adicionar `shadow-sm` já descaracteriza. Sombra só em overlay real
(dialog, popover): `--ie-shadow-overlay`.

Ícones: os do mockup são stroke de 1.7 em grade 24. Em código use `lucide-react`
com `strokeWidth={1.7}` e `size={18}` (nav, linhas) ou `size={20}` (ações). Não
copie os SVGs desenhados à mão para dentro do app.

---

## 5. Inventário de componentes

O que o canvas mostra, traduzido em unidades de código. Comece por cima.

### `packages/ui` — primitivos, sem regra de negócio

| Componente | Onde aparece | Observação |
| --- | --- | --- |
| `Card` | todas | `rounded-card p-6 bg-card`, sem sombra |
| `StatCard` | dashboard | ícone em caixa 34px + número + rótulo; variante de tom |
| `StatusBadge` | todas | variantes `success · warning · danger · info · neutral` |
| `SegmentedControl` | chamada | trilho `bg-surface-4 p-1`, item ativo colorido; alvo ≥44px no mobile |
| `NavItem` | casca | estado ativo = pílula `--ie-primary-soft` + texto `--ie-primary-ink` |
| `InitialsAvatar` | listas | iniciais + tom derivado do estado, não do nome |
| `MiniCalendar` | dashboard | marcação por tipo de evento (prova, conselho, prazo) |
| `EmptyState` / `ErrorState` / `PermissionState` | todas | ícone + título + explicação + ação |
| `ListSkeleton` | todas | esqueleto com a forma do conteúdo, nunca spinner de tela |
| `GradeCell` | notas | estados: preenchida, em edição, vazia obrigatória, travada |

### `apps/web` — blocos com dados

`AppShell` (sidebar + `ContextBar` + topo), `SchoolSwitcher`, `AulasDeHoje`,
`MediaPorTurma`, `AgendaResumo`, `PrecisamDeAtencao`, `ChamadaTurma`,
`ResumoChamada`, `ConteudoDaAula`, `GradeDeNotas`, `AvaliacaoCards`.

### `ContextBar` é o componente mais importante da casca

Instituição + ano letivo + período ativos, visível em **toda** tela, inclusive no
mobile. No mockup é um detalhe visual; no produto é a regra que impede um professor
com dois vínculos de registrar chamada na escola errada. Ele lê do contexto do
tenant, não de prop solta.

---

## 6. O que **não** copiar do mockup

- Nomes, matrículas, notas e percentuais — são fictícios e coerentes só entre si.
- Estilos inline: no canvas eles existem para o editor visual funcionar.
- Os SVGs de ícone (viram `lucide-react`).
- As barras do gráfico feitas com `div` — no app, gráfico de verdade, com os
  tokens `--chart-*` na mesma ordem (lavanda = período atual, amarelo = anterior).
- O `min-height` das pranchas: é tamanho de moldura, não de layout.

---

## 7. Guarda automática contra deriva

O repositório já tem cultura disso (`architecture.test.ts`). O equivalente aqui é
um teste que reprova cor solta:

- **Regra:** nenhum arquivo em `apps/web/src/**` ou `packages/ui/src/components/**`
  pode conter literal de cor — `#rrggbb`, `rgb(`, `hsl(`, `oklch(`. A única
  exceção é `packages/ui/src/styles/`.
- **Motivo:** é assim que a fidelidade vaza, um componente por vez, e ninguém
  percebe até a tela estar 8% diferente do mockup.

Vale a mesma ideia para raio e sombra soltos (`rounded-[`, `shadow-[`) fora dos
tokens, se quiser apertar mais.

---

## 8. Checklist antes de dar uma tela como pronta

- [ ] Nenhuma cor, raio ou sombra literal no componente
- [ ] Os quatro estados existem: vazio, carregando, erro, sem permissão
- [ ] `ContextBar` visível e correta
- [ ] Nada fora do escopo do vínculo aparece na tela (nem "não autorizado" com dado)
- [ ] Rascunho e publicado são visualmente distintos onde há nota
- [ ] Alvos de toque ≥44px no mobile
- [ ] Foco de teclado visível em tudo que é interativo
- [ ] Screenshot em 1440 e em 390 comparado lado a lado com o PNG a 100%
- [ ] Texto real em pt-BR, sem `Lorem` e sem string em inglês

---

## 9. Sugestão de sequência de PRs

1. Tokens + fonte + `AppShell` com sidebar e `ContextBar` (nenhuma tela ainda)
2. Primitivos: `Card`, `StatusBadge`, `StatCard`, `InitialsAvatar`, estados
3. Dashboard do Professor com dados reais das turmas do vínculo
4. Chamada (desktop e mobile na mesma PR — o mobile é o caso de uso real)
5. Avaliações + grade de notas com rascunho/publicado
6. Fechamento de bimestre

Cada PR fecha com o comparativo screenshot × PNG no corpo da descrição. É o que
mantém a discussão sobre a tela, e não sobre a lembrança que cada um tem dela.
