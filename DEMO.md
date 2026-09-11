# Integra Edu — roteiro de demonstração

Como subir o MVP com dados e o que mostrar, em ordem. Leva ~5 minutos de
preparo e ~10 de apresentação.

## Preparo

```bash
pnpm install
pnpm run db:start
pnpm run db:migrate
pnpm run seed:demo
pnpm run dev
```

O app sobe em <http://localhost:3001>.

**Rode `pnpm run seed:demo` no dia da apresentação.** As aulas são geradas em
torno da data de execução — é isso que faz "Aulas de hoje" ter conteúdo. Rodar
de novo apaga e regrava a escola de demonstração, então dá para ensaiar,
bagunçar e voltar ao estado inicial.

## Acessos

Escola fictícia **E. M. Dom Pedro II**, senha `integra2026` para todos:

| Visão | Perfil | E-mail |
| --- | --- | --- |
| **Instituição** | Direção (`owner`) | `marina.duarte@dompedroii.edu.br` |
| **Professor** | Matemática (`teacher`) | `ricardo.alves@dompedroii.edu.br` |
| **Aluno** | 8º A (`student`) | `ana.clara@aluno.dompedroii.edu.br` |

Há também `vera.amorim@dompedroii.edu.br` (secretaria, `admin`), mesma senha —
útil só para mostrar que a direção e a secretaria enxergam o mesmo, com papéis
distintos. Os demais professores existem no quadro mas não fazem parte do
roteiro.

> Senha fraca e compartilhada existe **só** para esta escola de demonstração,
> com dados fictícios. Instalação real é provisionada por
> `pnpm --filter @educa-escola/auth run provision`, com senha própria.

## O que o seed deixa preparado

Uma escola municipal inteira, de porte realista:

- **12 turmas** (6º ao 9º ano), **299 alunos**, **20 professores**, 8 disciplinas
- Grade horária de verdade: 20 aulas semanais por turma, quatro tempos por dia,
  **sem professor em duas salas ao mesmo tempo**
- ~2.450 aulas em nove semanas de histórico e uma semana à frente, com ~9.450
  notas lançadas
- Frequência média da rede em 93,7%; **28 alunos abaixo dos 75%** da LDB, entre
  eles os dois do roteiro — Júlia Moraes (67%) e Davi Fontes Xavier (69%)
- 10 matrículas com documentação pendente, incluindo Helena Lacerda no 8º A
- Chamadas registradas em quase todo o histórico. **Ricardo tem exatamente uma
  aula anterior sem registro** — é a pendência que o roteiro usa; outros quatro
  professores têm as suas, para a fila de cobrança da direção não ter uma linha
  só
- Por turma e disciplina: duas avaliações publicadas e uma Prova 2. No **8º A de
  Matemática** ela está em rascunho, com **dois alunos sem nota** — é o que
  trava a publicação

## Roteiro

### 1. Professor — o dia (2 min)

Entre como Ricardo. O painel abre com aulas de hoje, chamada em atraso, notas a
lançar, média por turma comparada ao bimestre anterior e os alunos abaixo do
mínimo de frequência.

**O que dizer:** todo número vem do banco. A frequência de 67% da Júlia é a
divisão das presenças pelas aulas dela, não um valor de exemplo.

### 2. Professor — chamada (3 min)

Clique em **Fazer chamada** numa aula de hoje.

- A turma inteira já vem **presente**: só as exceções são marcadas. É a meta de
  chamada em menos de 60 segundos.
- Marque duas faltas e veja o resumo e a frequência da aula mudarem na hora.
- Salve e volte: a aula passa a "Chamada registrada" e o contador do menu cai.
- **Abra a aula em atraso** (a de ontem, no topo). Ela exige justificativa —
  registrar fora do prazo é corrigir histórico, e correção precisa de motivo.

**Mostre em tela estreita.** Reduza a janela: a lateral recolhe no botão do
topo e vira painel deslizante, a linha do aluno empilha e os alvos ficam com
44px. Continua sendo um app web — não há barra inferior de aplicativo nativo.

### 3. Professor — notas (2 min)

Vá em **Notas e avaliações** e escolha o 8º A.

- Duas avaliações publicadas (células travadas) e uma em rascunho (editáveis).
- Dois alunos sem nota: célula tracejada em âmbar, situação "Sem nota" — com
  lançamento faltando o sistema **não** dá veredito sobre o aluno.
- Clique em **Publicar notas**: é recusado, com o motivo.
- Preencha as duas notas, **Salvar rascunho**, depois **Publicar**. Agora passa.

### 4. Aluna — o outro lado (2 min)

Saia e entre como Ana Clara.

- Frequência, média geral e **as notas que acabaram de ser publicadas**. Antes
  da publicação elas não existiam para ela: o filtro é na consulta, não na tela.
- O gráfico "Desempenho por disciplina" traz as **oito disciplinas** dela contra
  a média da turma, e o dia inteiro de aulas com professor e sala de cada uma.
- Em **Minhas notas**, cada avaliação mostra `nota × peso` e o peso total. "Como
  sua média foi calculada" é requisito.
- Comparação com a turma é anônima: nenhum nome de colega em lugar nenhum.

### 5. Direção — a escola (1 min)

Entre como Marina.

- Alunos ativos, turmas, professores, frequência média da rede.
- **Pendências de lançamento** por professor, numa fila só: quem deve chamada e
  quem deve apenas nota aparecem lado a lado, ordenados pelo tamanho da dívida.
- **Alunos**: 299 matrículas paginadas, com busca, filtros combináveis e o
  recorte "Alerta de frequência", derivado dos 75% da LDB — não um campo que
  alguém marca.

## Se algo der errado

| Sintoma | Causa provável |
| --- | --- |
| "Nenhuma escola ativa" | Sessão antiga, de antes do seed. Saia e entre de novo. |
| Dashboard vazio | `pnpm run seed:demo` não rodou, ou rodou em outro banco. |
| "Aulas de hoje" vazio | Seed rodado em outro dia, ou hoje é fim de semana — a grade é de segunda a sexta. |
| Porta 3001 ocupada | Outro `vite dev` aberto. Feche-o: o `BETTER_AUTH_URL` aponta para 3001. |

## O que ainda não existe

Vale dizer antes que perguntem — os itens marcados **em breve** no menu são o
roadmap do `INTEGRA-EDU-REQUISITOS.md`, não telas quebradas:

- Matrículas, financeiro, comunicados, relatórios e calendário
- Grade horária e diário completo do aluno
- Troca de instituição na barra de contexto (o modelo já é multi-escola; falta a
  troca sem sair e entrar)
- Tema escuro e a fonte Plus Jakarta Sans local (hoje cai no fallback do sistema)
