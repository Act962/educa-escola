# Referência visual — fluxo do Professor

PNGs exportados do canvas de design do Integra Edu. **Esta pasta é a referência
que o código persegue.** O canvas é editável e muda; estes arquivos, não — só
quando um PR os substitui de propósito.

| Arquivo | Prancha | Tamanho |
| --- | --- | --- |
| `01-professor-dashboard.png` | Dashboard do Professor | 1440 × 1080 |
| `02-professor-chamada.png` | Chamada (desktop) | 1440 × 1080 |
| `03-professor-notas.png` | Lançamento de notas | 1440 × 1080 |
| `04-professor-chamada-mobile.png` | Chamada (mobile) | 390 × 844 |
| `05-estados.png` | Estados: vazio, carregando, erro, sem permissão | 1440 × 560 |

Exportados em 2× (retina). Tipografia: Plus Jakarta Sans.

## Canvas de origem

https://claude.ai/code/artifact/06b60c49-cbb7-4c62-8389-f9a3f2611436

O canvas é privado até ser compartilhado. Lá dá para inspecionar cada elemento,
ler os valores exatos e exportar PNG/PDF de novo.

## Como usar numa PR

Coloque, na descrição da PR, o screenshot da tela implementada ao lado do PNG
correspondente, ambos a 100%. A conversa passa a ser sobre a diferença visível,
não sobre a lembrança que cada um tem do mockup.

Os valores de cor, raio, tipografia e espaçamento não se leem daqui a olho:
estão em `INTEGRA-EDU-UI-KIT.md` e em `packages/ui/src/styles/integra-tokens.css`.

## Quando o canvas mudar

Reexporte as pranchas afetadas e commite os PNGs **no mesmo PR** que aplica a
mudança no código. PNG desatualizado é pior que PNG nenhum.
