import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { useEffect, useState } from "react";

import { dataParaISO, idadeEm, isoParaData, mascararData } from "@/lib/masks";

/**
 * Campo de data mascarado, em texto — não o seletor nativo.
 *
 * O seletor do navegador obriga a navegar com o mouse até o mês certo, e para
 * data de nascimento é pior ainda: abre no mês corrente e exige uma década de
 * cliques para chegar a 2015. Aqui a pessoa digita oito dígitos seguidos e as
 * barras aparecem sozinhas.
 *
 * Nasceu dentro da tela de matrícula e vive aqui porque o calendário precisa
 * do mesmo comportamento. Duas implementações do mesmo campo divergiriam na
 * primeira correção — e uma delas continuaria aceitando 31 de fevereiro.
 *
 * Fala ISO (`2026-09-07`) para fora e dd/mm/aaaa para a pessoa: quem usa o
 * componente nunca lida com o formato de tela, e o servidor nunca lida com
 * barras.
 *
 * **O texto digitado é estado daqui, não do pai.** Derivar o texto do ISO
 * parece mais limpo e torna a data inválida *irrepresentável*: "31/02/2026"
 * não vira ISO, o pai guarda nulo, e o que a pessoa acabou de digitar
 * desaparece da tela enquanto ela olha. O pai recebe o ISO quando existe, e
 * `null` enquanto não existe.
 */
export function CampoDeData({
  id,
  label,
  value,
  onChange,
  hint,
  mostrarIdade,
  min,
  max,
}: {
  id: string;
  label: string;
  /** Data em ISO, ou string vazia. */
  value: string;
  /** Recebe ISO quando a data é válida, e `null` enquanto está incompleta. */
  onChange: (iso: string | null) => void;
  hint?: string;
  /** Mostra a idade ao lado — conferência para data de nascimento. */
  mostrarIdade?: boolean;
  min?: string;
  max?: string;
}) {
  const [texto, setTexto] = useState(() => isoParaData(value));

  // Sincroniza quando o valor muda por fora (carregou do servidor, foi
  // limpo). Só quando diverge do que está na tela, para não atropelar a
  // digitação em andamento.
  useEffect(() => {
    const doPai = isoParaData(value);
    setTexto((atual) => (dataParaISO(atual) === (value || null) ? atual : doPai));
  }, [value]);

  const completo = texto.replace(/\D/g, "").length === 8;
  const iso = dataParaISO(texto);
  const idade = mostrarIdade ? idadeEm(iso) : null;

  const foraDoIntervalo =
    iso !== null && ((min !== undefined && iso < min) || (max !== undefined && iso > max));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          className={idade !== null ? "pr-20 tabular-nums" : "tabular-nums"}
          value={texto}
          onChange={(evento) => {
            const mascarado = mascararData(evento.target.value);
            setTexto(mascarado);
            onChange(dataParaISO(mascarado));
          }}
        />
        {idade !== null ? (
          <span
            className={`absolute top-1/2 right-3 -translate-y-1/2 font-bold text-meta ${
              idade < 0 || idade > 120 ? "text-danger" : "text-muted-foreground"
            }`}
          >
            {idade} anos
          </span>
        ) : null}
      </div>

      {/* A data impossível é avisada na hora, não no envio: 31/02 digitado
          agora e recusado três campos depois faz a pessoa procurar o erro. */}
      {completo && !iso ? (
        <p className="text-danger text-meta">Esta data não existe no calendário.</p>
      ) : foraDoIntervalo ? (
        <p className="text-danger text-meta">
          Use uma data entre {isoParaData(min ?? "")} e {isoParaData(max ?? "")}.
        </p>
      ) : hint ? (
        <span className="text-meta text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}
