import type { Botao, ModeloDeMensagem } from "@educa-escola/api/messaging/whatsapp/template";
import { renderizar } from "@educa-escola/api/messaging/whatsapp/template";
import { ExternalLink, Phone, Reply } from "lucide-react";

/**
 * A mensagem como ela chega no celular.
 *
 * **Usa a mesma `renderizar` do servidor**, importada de
 * `messaging/whatsapp/template.ts`. Uma segunda implementação aqui — um
 * `replace` no JSX, que é o caminho óbvio — faria a direção aprovar uma coisa
 * e o histórico guardar outra, e a divergência só apareceria numa reclamação.
 *
 * Não imita a cor do WhatsApp. A prévia existe para conferir **texto**:
 * quebra de linha, variável esquecida, rodapé, ordem dos botões. Pintar de
 * verde exigiria literal de cor, que o design system reprova com razão — e
 * daria a impressão de fidelidade visual que esta tela não tem como garantir.
 */
export function PreviaDaMensagem({
  modelo,
  valores,
}: {
  modelo: ModeloDeMensagem;
  valores: Record<string, string>;
}) {
  const previa = renderizar(modelo, valores);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
      <p className="text-meta text-muted-foreground uppercase tracking-wide">Prévia</p>

      <div className="flex flex-col overflow-hidden rounded-xl bg-card shadow-sm">
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          {previa.cabecalho ? (
            <p className="font-bold text-corpo leading-snug">{previa.cabecalho}</p>
          ) : null}

          {/* `whitespace-pre-wrap`: quebra de linha é conteúdo no WhatsApp, e
              uma prévia que junta os parágrafos esconde o defeito mais comum. */}
          <p className="whitespace-pre-wrap text-corpo leading-relaxed">{previa.corpo}</p>

          {previa.rodape ? (
            <p className="text-meta text-muted-foreground">{previa.rodape}</p>
          ) : null}
        </div>

        {previa.botoes.length > 0 ? (
          <div className="flex flex-col">
            {previa.botoes.map((botao) => (
              <BotaoDaPrevia key={`${botao.tipo}-${botao.texto}`} botao={botao} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BotaoDaPrevia({ botao }: { botao: Botao }) {
  const Icone = botao.tipo === "link" ? ExternalLink : botao.tipo === "telefone" ? Phone : Reply;

  return (
    <div className="flex items-center justify-center gap-1.5 border-border border-t px-3 py-2 text-corpo text-info">
      <Icone className="size-3.5" aria-hidden />
      {botao.texto}
    </div>
  );
}
