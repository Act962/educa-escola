import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Progress, ProgressLabel, ProgressValue } from "@educa-escola/ui/components/progress";
import { CircleDollarSign, Info, TriangleAlert } from "lucide-react";

import { integerText, utcDateText } from "@/lib/format";
import type { RouterOutputs } from "@/utils/trpc";

type Consumo = NonNullable<RouterOutputs["whatsapp"]["visao"]["consumo"]>;

const TOM: Record<Consumo["estado"], "success" | "warning" | "danger"> = {
  tranquilo: "success",
  atencao: "warning",
  critico: "warning",
  esgotado: "danger",
};

const ROTULO: Record<Consumo["estado"], string> = {
  tranquilo: "Dentro da cota",
  atencao: "Consumo alto",
  critico: "Quase no limite",
  esgotado: "Cota esgotada",
};

/**
 * A cota gratuita do mês, no alto da aba.
 *
 * Fica **acima** do trilho de abas, e não dentro de uma delas, porque é o
 * número que muda a decisão em qualquer das três: escrever um modelo novo,
 * mandar um teste ou olhar o histórico. Escondido numa aba, seria consultado
 * depois de a escola já ter gasto.
 *
 * A barra conta **conversas**, não mensagens — é a unidade que a Meta cobra.
 * Várias mensagens para a mesma família dentro de 24 horas são uma conversa, e
 * um painel que contasse mensagens acusaria um gasto que não houve.
 */
export function CotaDoMes({ consumo }: { consumo: Consumo }) {
  const tom = TOM[consumo.estado];

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tom}>{ROTULO[consumo.estado]}</Badge>
        <span className="font-semibold text-corpo">Conversas gratuitas do mês</span>
        <span className="text-meta text-muted-foreground">
          · renova em {utcDateText(consumo.renovaEm)}
        </span>
      </div>

      <Progress value={Math.min(consumo.conversas, consumo.teto)} max={Math.max(consumo.teto, 1)}>
        <ProgressLabel>
          {integerText(consumo.conversas)} de {integerText(consumo.teto)} usadas
        </ProgressLabel>
        <ProgressValue className={tom === "danger" ? "text-danger" : undefined}>
          {() => `${integerText(consumo.restantes)} restantes`}
        </ProgressValue>
      </Progress>

      <p className="text-corpo text-muted-foreground">{consumo.recado}</p>

      {consumo.mensagensPorModelo > 0 ? (
        <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
          <CircleDollarSign className="size-3.5 shrink-0" aria-hidden />
          {integerText(consumo.mensagensPorModelo)}{" "}
          {consumo.mensagensPorModelo === 1 ? "mensagem" : "mensagens"} por modelo neste mês. Essas
          a Meta cobra por mensagem, fora da cota.
        </p>
      ) : null}

      {consumo.estado === "esgotado" ? (
        <Alert variant={consumo.bloqueado ? "danger" : "warning"}>
          <TriangleAlert />
          <AlertTitle>
            {consumo.bloqueado
              ? "Novas conversas estão bloqueadas"
              : "A partir daqui, a Meta cobra"}
          </AlertTitle>
          <AlertDescription>
            {consumo.bloqueado
              ? "Responder a quem já escreveu continua liberado — o que está travado é começar conversa nova. Para assumir o custo, desligue o bloqueio em Número."
              : "O bloqueio está desligado nas configurações deste número, então as mensagens continuam saindo e passam a ser cobradas."}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* O aviso que impede a discussão errada: este número é nosso, a fatura
          é da Meta. Painel que se apresenta como fatura e não é vira conversa
          sobre um valor que nunca foi nosso. */}
      <p className="flex items-start gap-1.5 text-meta text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Estimativa nossa, contada a partir do que saiu daqui desde {utcDateText(consumo.desde)}. A
        cobrança é da Meta e pode divergir — o valor oficial está no Gerenciador do WhatsApp
        Business.
      </p>
    </div>
  );
}
