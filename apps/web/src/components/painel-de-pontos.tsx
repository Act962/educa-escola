import { Badge } from "@educa-escola/ui/components/badge";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Progress, ProgressLabel, ProgressValue } from "@educa-escola/ui/components/progress";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { Sparkles } from "lucide-react";

import { inteiro } from "@/lib/format";

/** O que o servidor devolve em comum para aluno e professor. */
export interface PontosDoSujeito {
  pontos: number;
  nivel: { ordem: number; nome: string; minimo: number };
  proximo: { nivel: { nome: string; minimo: number }; faltam: number } | null;
  extrato: {
    id: string;
    ruleKey: string;
    label: string;
    points: number;
    term: number | null;
    occurredAt: string | Date;
  }[];
}

/**
 * Quanto do caminho entre o nível atual e o próximo já foi andado.
 *
 * Contado a partir do piso do nível atual, e não de zero: uma barra que anda
 * de zero até o próximo degrau fica quase cheia o tempo todo nos níveis altos
 * e não informa nada.
 */
export function progressoNoNivel(dados: PontosDoSujeito): number {
  if (!dados.proximo) return 100;
  const faixa = dados.proximo.nivel.minimo - dados.nivel.minimo;
  if (faixa <= 0) return 100;
  return Math.round(((dados.pontos - dados.nivel.minimo) / faixa) * 100);
}

/**
 * Cabeçalho de pontuação: total, nível e quanto falta para o próximo.
 *
 * Compartilhado entre o painel do aluno e o do professor porque a leitura é a
 * mesma; o que muda é o que vem ao lado, e isso fica na tela de cada um.
 */
export function ResumoDePontos({
  dados,
  ano,
  children,
}: {
  dados: PontosDoSujeito;
  ano: number;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-extrabold text-4xl tracking-[-1px]">{inteiro(dados.pontos)}</span>
        <span className="text-[13px] text-muted-foreground">pontos em {ano}</span>
        <Badge variant="info" className="ml-auto">
          <Sparkles size={14} strokeWidth={1.8} aria-hidden />
          {dados.nivel.nome}
        </Badge>
      </div>

      <Progress value={progressoNoNivel(dados)}>
        <ProgressLabel>
          {dados.proximo
            ? `Faltam ${inteiro(dados.proximo.faltam)} para ${dados.proximo.nivel.nome}`
            : "Último nível alcançado"}
        </ProgressLabel>
        <ProgressValue />
      </Progress>

      {children}
    </Card>
  );
}

/**
 * O extrato: os fatos que somam o total.
 *
 * Existe para a pergunta "por que eu tenho 284 pontos?" ter resposta na tela,
 * e não só no banco. Número que ninguém consegue conferir vira número que
 * ninguém acredita.
 */
export function ExtratoDePontos({ dados }: { dados: PontosDoSujeito }) {
  if (dados.extrato.length === 0) {
    return (
      <Card>
        <CardEyebrow>De onde vieram</CardEyebrow>
        <EmptyState
          title="Nenhum ponto ainda"
          description="Assim que houver aula registrada no ano letivo, os pontos aparecem aqui."
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardEyebrow>De onde vieram</CardEyebrow>
      <ul className="flex flex-col">
        {dados.extrato.map((linha) => (
          <li
            key={linha.id}
            className="flex items-center justify-between gap-4 border-border border-t py-2.5 text-[13px] first:border-t-0"
          >
            <span className="min-w-0">
              {linha.label}
              {linha.term ? (
                <span className="text-muted-foreground"> · {linha.term}º bimestre</span>
              ) : null}
            </span>
            <span className="shrink-0 font-bold text-success">+{linha.points}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function EsqueletoDePontos() {
  return (
    <Card>
      <ListSkeleton rows={4} />
    </Card>
  );
}
