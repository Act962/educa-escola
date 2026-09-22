import { Button } from "@educa-escola/ui/components/button";
import { OrbitaAstro } from "@educa-escola/ui/integra/orbita";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { useTRPC } from "@/utils/trpc";

/**
 * O Astro: a porta do assistente, no canto da tela.
 *
 * **Isto é a porta, não o assistente.** O Astro é um app do ecossistema
 * Órbita, e quem responde é ele — aqui mora o botão que leva até lá, com o
 * rosto da marca. Enquanto a escola não instalar o app, o botão diz o que o
 * assistente fará em vez de abrir uma tela que não existe: botão que promete
 * conversa e entrega erro é pior que botão nenhum.
 *
 * Fica à esquerda da borda e acima do rodapé, e não colado no canto: o
 * VLibras se posiciona sozinho no meio da borda direita, e os dois disputando
 * o mesmo pixel deixariam a pessoa surda sem tradutor para ganhar um
 * assistente.
 *
 * DECISÃO-JOÃO: de onde virão as respostas do assistente.
 * Quebra se: o Astro do Órbita responde a partir do dado que a **organização
 *   dele** enxerga, e aqui quem pergunta tem papel — aluno, professor,
 *   secretaria. Se a pergunta atravessar sem o papel junto, um aluno pergunta
 *   "qual a média da turma" e recebe a nota dos colegas. É o mesmo §7.5 que o
 *   placar respeita, e não dá para garanti-lo do lado de cá.
 * Fiz assim: o botão abre o app pela mesma porta dos outros doze
 *   (`/apps/astro`), que já carrega a identidade e a escola ativa. Nenhuma
 *   pergunta sai do Integra por conta própria.
 * Alternativas: o Órbita receber o papel no token de entrada e recortar lá ·
 *   um endpoint nosso que responda com o dado já filtrado, e o Astro só
 *   conversar — mais trabalho, e o recorte fica onde a regra mora.
 */
export function Astro() {
  const trpc = useTRPC();
  const [aberto, setAberto] = useState(false);

  const assistente = useQuery({
    ...trpc.orbita.assistente.queryOptions(),
    // Sem escola ativa a procedure recusa; o botão simplesmente não aparece.
    retry: false,
  });

  // Fechar com Esc é o que a pessoa tenta primeiro, e o cartão não é um
  // diálogo modal — então o atalho precisa ser nosso.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (assistente.isError) return null;

  const disponivel = assistente.data?.disponivel ?? false;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {aberto ? <CartaoDoAstro disponivel={disponivel} aoFechar={() => setAberto(false)} /> : null}

      <button
        type="button"
        onClick={() => setAberto((estado) => !estado)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar o Astro" : "Abrir o Astro, assistente da escola"}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {aberto ? (
          <X size={22} strokeWidth={2} aria-hidden />
        ) : (
          // Sem halo: sobre o azul do botão, a silhueta clara da marca
          // desenharia um contorno branco em volta do traço.
          <OrbitaAstro className="w-7" />
        )}
      </button>
    </div>
  );
}

function CartaoDoAstro({ disponivel, aoFechar }: { disponivel: boolean; aoFechar: () => void }) {
  return (
    <div className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-card bg-card p-5 shadow-overlay">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-info-soft text-info">
          <OrbitaAstro className="w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold text-card tracking-[-0.2px]">Astro</p>
          <p className="text-meta text-muted-foreground">Assistente do Órbita Edu</p>
        </div>
      </div>

      <p className="text-corpo text-muted-foreground">
        Pergunte sobre a escola em linguagem comum — frequência, notas, prazos, o que estiver
        pendente.
      </p>

      {/*
        A regra de permissão dita na porta, não escondida no contrato. É o que
        separa um assistente de um vazamento: o aluno perguntando "como está a
        minha turma" não pode receber a nota dos colegas.
      */}
      <p className="rounded-control bg-muted px-3 py-2.5 text-meta text-muted-foreground">
        O Astro responde dentro do que você já pode ver. Aluno enxerga o que é dele; professor, as
        turmas dele; a secretaria, a escola.
      </p>

      {disponivel ? (
        <Button
          nativeButton={false}
          render={<Link to="/apps/$appKey" params={{ appKey: "astro" }} />}
        >
          Conversar com o Astro
        </Button>
      ) : (
        <>
          <p className="text-meta text-muted-foreground">
            A escola ainda não ativou o Astro. Quem contrata é a direção, na aba Apps.
          </p>
          <Button variant="secondary" nativeButton={false} render={<Link to="/apps" />}>
            Ver na aba Apps
          </Button>
        </>
      )}

      <Button variant="ghost" size="sm" className="self-start" onClick={aoFechar}>
        Fechar
      </Button>
    </div>
  );
}
