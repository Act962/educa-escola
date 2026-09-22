import { SidebarGroup, SidebarGroupContent } from "@educa-escola/ui/components/sidebar";
import { cn } from "@educa-escola/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

type Nivel = "ok" | "atencao" | "critico" | "esgotado";

/**
 * A cor é a do estado, e a do trilho é sempre a mesma.
 *
 * Trilho que muda de cor junto com o preenchimento faz a barra inteira parecer
 * cheia — é o preenchimento que tem de contar a história.
 */
const COR_DA_BARRA: Record<Nivel, string> = {
  ok: "bg-primary",
  atencao: "bg-warning",
  critico: "bg-danger",
  esgotado: "bg-danger",
};

const inteiro = (n: number) => n.toLocaleString("pt-BR");

/**
 * Uma barra de uso, com o número por extenso ao lado.
 *
 * A porcentagem sozinha esconde a escala: "94%" não diz se falta muito ou uma
 * pergunta. O número bruto fica visível e é ele que a direção compara com a
 * fatura.
 */
function Barra({
  rotulo,
  usado,
  teto,
  nivel,
  sufixo,
}: {
  rotulo: string;
  usado: number;
  teto: number | null;
  nivel: Nivel;
  sufixo?: string;
}) {
  // Passa do teto quando a última resposta custa mais do que sobrava. A barra
  // para em 100%; o número ao lado não, porque é ele que mostra o excesso.
  const pct = teto && teto > 0 ? Math.min(100, Math.round((usado / teto) * 100)) : null;

  const numero = teto === null ? inteiro(usado) : `${inteiro(usado)}/${inteiro(teto)}`;

  return (
    <div className="flex flex-col gap-1">
      {/*
        O rótulo ocupa a linha inteira, e o número desce para junto da barra.
        Lado a lado eles não cabem na largura da barra lateral: "Tokens no mês"
        quebrava no meio da frase e o número ficava pendurado na primeira
        linha — a mesma desorganização de rótulo com contador solto.
      */}
      <span className="font-bold text-meta text-muted-foreground">{rotulo}</span>
      <div className="flex items-center gap-2">
        {pct === null ? (
          // Sem teto declarado não há barra: desenhar uma vazia sugeriria um
          // limite folgado que ninguém definiu.
          <span className="flex-1 text-meta text-muted-foreground">sem teto</span>
        ) : (
          <div
            role="progressbar"
            aria-label={rotulo}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className={cn("h-full rounded-full transition-all", COR_DA_BARRA[nivel])}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <span className="whitespace-nowrap font-extrabold text-apoio tabular-nums">
          {numero}
          {sufixo ? <span className="font-bold text-muted-foreground"> {sufixo}</span> : null}
        </span>
      </div>
    </div>
  );
}

/**
 * O que o alerta diz depende de **o que** está acabando e de já ter acabado.
 *
 * "Esgotado" não é aviso, é notícia: o Astro já parou de responder, e a frase
 * precisa dizer quando ele volta — senão a direção vai procurar defeito numa
 * tela que está funcionando como configurada.
 */
function aviso(uso: {
  nivel: Nivel;
  perguntas: { nivel: Nivel; teto: number };
  tokens: { nivel: Nivel };
}): string | null {
  if (uso.nivel === "ok") return null;

  const dasPerguntas = uso.perguntas.nivel === uso.nivel;

  if (uso.nivel === "esgotado") {
    return dasPerguntas
      ? `As ${inteiro(uso.perguntas.teto)} perguntas de hoje acabaram. O Astro volta amanhã.`
      : "O orçamento de tokens do mês acabou. O Astro parou até o dia 1º ou até a direção ampliá-lo.";
  }

  const oque = dasPerguntas ? "O limite de perguntas de hoje" : "O orçamento de tokens do mês";
  return uso.nivel === "critico" ? `${oque} está quase no fim.` : `${oque} passou de 80%.`;
}

/**
 * Consumo do Astro no rodapé da barra lateral.
 *
 * Só para a direção: quanto a escola gasta com o modelo é número de custo, e
 * quem vê é quem assina — o servidor exige `assistant: ["manage"]`, e esconder
 * aqui evita o 403. Professor e aluno recebem o que lhes serve, quantas
 * perguntas ainda cabem hoje, na própria resposta do Astro.
 *
 * Some inteiro quando o Astro está desligado: painel zerado de um recurso que
 * a escola não contratou é ruído permanente no rodapé.
 */
export function PainelDeUsoDoAstro({ podeVer }: { podeVer: boolean }) {
  const trpc = useTRPC();
  const uso = useQuery({
    ...trpc.assistant.uso.queryOptions(),
    enabled: podeVer,
    retry: false,
    // O contador anda a cada pergunta feita por qualquer pessoa da escola. Um
    // minuto é curto o bastante para o alerta chegar antes do limite e longo
    // o bastante para não virar consulta a cada navegação.
    staleTime: 60_000,
  });

  if (!podeVer || !uso.data?.ligado) return null;

  const texto = aviso(uso.data);
  const critico = uso.data.nivel === "critico" || uso.data.nivel === "esgotado";

  return (
    <SidebarGroup className="p-0 group-data-[collapsible=icon]:hidden">
      <SidebarGroupContent>
        <div className="flex flex-col gap-3 rounded-control bg-muted p-3">
          <span className="font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]">
            Astro · consumo
          </span>

          <Barra
            rotulo="Perguntas hoje"
            usado={uso.data.perguntas.usadas}
            teto={uso.data.perguntas.teto}
            nivel={uso.data.perguntas.nivel}
          />

          <Barra
            rotulo="Tokens no mês"
            usado={uso.data.tokens.usados}
            teto={uso.data.tokens.teto}
            nivel={uso.data.tokens.nivel}
          />

          {/*
            O provedor nem sempre devolve `usage`. Sem esta linha, o orçamento
            pareceria mais folgado do que está, e a direção descobriria a
            diferença pela fatura.
          */}
          {uso.data.tokens.semContagem > 0 ? (
            <p className="text-meta text-muted-foreground">
              {uso.data.tokens.semContagem}{" "}
              {uso.data.tokens.semContagem === 1 ? "resposta" : "respostas"} do mês sem contagem do
              provedor — o consumo real é maior.
            </p>
          ) : null}

          {texto ? (
            <p
              className={cn(
                "flex items-start gap-2 font-bold text-meta",
                critico ? "text-danger" : "text-warning",
              )}
            >
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.2} />
              <span>{texto}</span>
            </p>
          ) : null}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
