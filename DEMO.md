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

| Perfil | E-mail |
| --- | --- |
| Direção | `marina.duarte@dompedroii.edu.br` |
| Professor | `ricardo.alves@dompedroii.edu.br` |
| Aluna | `ana.clara@aluno.dompedroii.edu.br` |

> Senha fraca e compartilhada existe **só** para esta escola de demonstração,
> com dados fictícios. Instalação real é provisionada por
> `pnpm --filter @educa-escola/auth run provision`, com senha própria.

## O que o seed deixa preparado

- 3 turmas (8º A, 9º B, 7º C), 20 alunos, 5 disciplinas, ~143 aulas
- Chamadas registradas em quase todo o histórico, **uma aula anterior de
  propósito sem registro** — é a pendência do painel
- 2 alunos abaixo dos 75% de frequência (Júlia Moraes, Davi Fontes Xavier)
- 1 aluna com documentação pendente (Helena Lacerda)
- Por turma: duas avaliações publicadas e **uma em rascunho**, com dois alunos
  do 8º A sem nota — é o que trava a publicação

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

**Mostre no celular.** Reduza a janela: a barra vira inferior, a linha do aluno
empilha e os alvos ficam com 44px. É onde a chamada acontece de verdade.

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
- Em **Minhas notas**, cada avaliação mostra `nota × peso` e o peso total. "Como
  sua média foi calculada" é requisito.
- Comparação com a turma é anônima: nenhum nome de colega em lugar nenhum.

### 5. Direção — a escola (1 min)

Entre como Marina.

- Alunos ativos, turmas, professores, frequência média da rede.
- **Pendências de lançamento** por professor: chamadas e notas em aberto.
- **Alunos** com busca, filtros e o recorte "Alerta de frequência", que é
  derivado dos 75% da LDB, não um campo que alguém marca.

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
