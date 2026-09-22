import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Card que recolhe, com o estado lembrado entre visitas.
 *
 * Nasceu no calendário, que é a tela mais comprida do produto: período letivo,
 * quarenta linhas de feriado nacional, o formulário de evento e a lista do ano
 * inteiro, um embaixo do outro. Quem entra para conferir uma data rola a
 * página toda por causa de uma seção que já resolveu em fevereiro.
 *
 * **Recolhido não é escondido.** O título continua na tela e a seta diz que há
 * mais ali — a diferença para simplesmente tirar da página é essa, e é por ela
 * que o roadmap continua visível.
 */
export function SecaoRetratil({
  id,
  titulo,
  descricao,
  resumo,
  aberta,
  aoAlternar,
  acao,
  children,
}: {
  /** Vira o `id` do elemento: é por ele que a barra de seções rola até aqui. */
  id: string;
  titulo: string;
  descricao?: string;
  /** Uma linha que resume o conteúdo quando ele está recolhido. */
  resumo?: string;
  aberta: boolean;
  aoAlternar: () => void;
  /**
   * Controles do cabeçalho — um filtro, um botão de importar.
   *
   * Fica **fora** do botão que recolhe: um `Select` dentro dele fecharia a
   * seção a cada clique, e o gesto de filtrar viraria o gesto de esconder.
   */
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  const conteudo = `${id}-conteudo`;

  return (
    <Card id={id} className="flex scroll-mt-4 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          aria-controls={conteudo}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <CardEyebrow>{titulo}</CardEyebrow>
          {!aberta && resumo ? (
            <span className="min-w-0 truncate text-[12px] text-muted-foreground">{resumo}</span>
          ) : null}
          <ChevronDown
            size={18}
            strokeWidth={1.8}
            aria-hidden
            className={`ml-auto shrink-0 text-muted-foreground transition-transform ${
              aberta ? "rotate-180" : ""
            }`}
          />
        </button>
        {acao}
      </div>

      {/*
        Desmontado, e não escondido com CSS: a lista de eventos do ano tem
        centenas de nós, e mantê-los na árvore para não ver nada é pagar o
        custo do que a pessoa acabou de dispensar.
      */}
      {aberta ? <div id={conteudo}>{children}</div> : null}

      {aberta && descricao ? (
        <p className="text-[12px] text-muted-foreground">{descricao}</p>
      ) : null}
    </Card>
  );
}

/**
 * Quais seções estão abertas, lembrado no navegador.
 *
 * A leitura do `localStorage` acontece **depois** da montagem, e não durante a
 * renderização: o servidor não tem `localStorage`, e ler ali faria o HTML do
 * servidor discordar do primeiro quadro do cliente. O preço é um instante com
 * o padrão na tela; a alternativa seria um erro de hidratação.
 *
 * Tudo dentro de `try`: em aba anônima, com dados de site bloqueados ou
 * durante a captura de miniatura, o acessor lança. Uma preferência de tela
 * recolhida não vale derrubar a página.
 */
export function useSecoesRetrateis(chave: string, padrao: Record<string, boolean>) {
  const [abertas, setAbertas] = useState(padrao);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      if (!salvo) return;
      const lido = JSON.parse(salvo) as Record<string, boolean>;
      // Mescla sobre o padrão: uma seção nova estreia com o padrão dela, em
      // vez de nascer recolhida só porque não estava no que foi salvo.
      setAbertas((atual) => ({ ...atual, ...lido }));
    } catch {
      // Sem preferência salva, valem os padrões.
    }
  }, [chave]);

  const gravar = useCallback(
    (proximas: Record<string, boolean>) => {
      setAbertas(proximas);
      try {
        window.localStorage.setItem(chave, JSON.stringify(proximas));
      } catch {
        // A tela continua funcionando; só não lembra na próxima visita.
      }
    },
    [chave],
  );

  const alternar = useCallback(
    (id: string) => gravar({ ...abertas, [id]: !abertas[id] }),
    [abertas, gravar],
  );

  /** Abre a seção e rola até ela. É o que a barra de seções faz. */
  const irPara = useCallback(
    (id: string) => {
      if (!abertas[id]) gravar({ ...abertas, [id]: true });
      // Um quadro depois: o conteúdo só existe na árvore após a abertura, e
      // rolar antes disso pararia na altura que o card tinha recolhido.
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [abertas, gravar],
  );

  return { abertas, alternar, irPara };
}
