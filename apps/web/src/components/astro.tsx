import { Button } from "@educa-escola/ui/components/button";
import { Input } from "@educa-escola/ui/components/input";
import { OrbitaAstro } from "@educa-escola/ui/integra/orbita";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { COR_DA_FAIXA, faixaDeUso, porcentagemDoTeto } from "@/lib/medidor-de-uso";
import { useTRPC } from "@/utils/trpc";

interface Fala {
  de: "pessoa" | "astro";
  texto: string;
}

/**
 * O Astro, assistente da escola.
 *
 * **Nativo**: a pergunta vai para o nosso servidor, que monta os fatos do
 * papel de quem perguntou e conversa com o modelo que a escola configurou.
 * Nenhum dado sai daqui por conta própria — e o modelo só enxerga o texto que
 * o servidor põe no contexto, que é o mesmo painel que a pessoa já abre.
 *
 * **A conversa não é guardada.** Ela vive nesta tela e some ao recarregar.
 * Persistir o que um aluno pergunta ao assistente é guardar conteúdo de
 * criança: outra finalidade, outro consentimento, outra conversa com a escola.
 * O que fica no banco é contagem, para o teto diário e para a escola saber o
 * que está gastando.
 *
 * Fica no canto inferior direito. O VLibras se posiciona sozinho no meio da
 * borda direita, então os dois não disputam o mesmo pixel — e deixar a pessoa
 * surda sem tradutor para ganhar um assistente seria uma troca ruim.
 */
export function Astro() {
  const trpc = useTRPC();
  const [aberto, setAberto] = useState(false);

  const situacao = useQuery({ ...trpc.assistant.situacao.queryOptions(), retry: false });

  /**
   * O consumo, para o anel e para o rodapé.
   *
   * `retry: false` porque quem não tem `assistant: ["manage"]` recebe 403, e
   * isso é resposta esperada, não falha: professor e aluno continuam com o
   * botão limpo. Gasto da escola é número de quem assina.
   */
  const uso = useQuery({
    ...trpc.assistant.uso.queryOptions(),
    retry: false,
    staleTime: 60_000,
  });

  const porcentagem = porcentagemDoTeto(uso.data?.tokens.usados ?? 0, uso.data?.tokens.teto);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (situacao.isError) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {aberto ? (
        <Painel
          disponivel={situacao.data?.disponivel ?? false}
          ligado={situacao.data?.ligado ?? false}
          uso={uso.data ?? null}
        />
      ) : null}

      <div className="relative size-14 shrink-0">
        <button
          type="button"
          onClick={() => setAberto((estado) => !estado)}
          aria-expanded={aberto}
          aria-label={aberto ? "Fechar o Astro" : "Abrir o Astro, assistente da escola"}
          className="flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {aberto ? (
            <X size={22} strokeWidth={2} aria-hidden />
          ) : (
            // Sem halo: sobre o azul do botão, a silhueta clara da marca
            // desenharia um contorno branco em volta do traço.
            <OrbitaAstro className="w-7" />
          )}
        </button>

        {porcentagem === null ? null : <Anel porcentagem={porcentagem} />}
      </div>
    </div>
  );
}

/**
 * O anel de consumo em volta do botão.
 *
 * Fica **fora** do botão, com `pointer-events-none`: desenhá-lo dentro faria
 * o traço competir com a área de clique, e o alvo de toque de um botão
 * flutuante é a coisa que menos pode encolher.
 *
 * Começa às doze horas e enche no sentido horário, que é como qualquer
 * mostrador é lido sem legenda.
 */
function Anel({ porcentagem }: { porcentagem: number }) {
  const raio = 30;
  const volta = 2 * Math.PI * raio;

  return (
    <svg
      viewBox="0 0 64 64"
      className="pointer-events-none absolute -inset-1 size-16 -rotate-90"
      aria-hidden
    >
      <title>{`${porcentagem}% do orçamento de tokens`}</title>
      <circle
        cx="32"
        cy="32"
        r={raio}
        fill="none"
        strokeWidth="3"
        className="stroke-muted-foreground/25"
      />
      <circle
        cx="32"
        cy="32"
        r={raio}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(volta * porcentagem) / 100} ${volta}`}
        className={`transition-all ${COR_DA_FAIXA[faixaDeUso(porcentagem)]}`}
      />
    </svg>
  );
}

interface UsoDoAstro {
  perguntas: { usadas: number; teto: number };
  tokens: { usados: number; teto: number | null };
}

function Painel({
  disponivel,
  ligado,
  uso,
}: {
  disponivel: boolean;
  ligado: boolean;
  uso: UsoDoAstro | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [falas, setFalas] = useState<Fala[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const perguntar = useMutation(
    trpc.assistant.perguntar.mutationOptions({
      onSuccess: (saida) => {
        setFalas((atuais) => [...atuais, { de: "astro", texto: saida.texto }]);
        setRestantes(saida.restantesHoje);
        // A pergunta acabou de mexer no contador da escola. Quem vê o painel
        // da barra lateral é a direção — para os demais a invalidação não
        // dispara nada, porque a query nem está montada.
        queryClient.invalidateQueries({ queryKey: trpc.assistant.uso.queryKey() });
      },
      // O erro entra na conversa em vez de virar um aviso solto: é resposta a
      // uma pergunta, e some do contexto se aparecer noutro canto da tela.
      onError: (erro) => setFalas((atuais) => [...atuais, { de: "astro", texto: erro.message }]),
    }),
  );

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (disponivel) campo.current?.focus();
  }, [disponivel]);

  const enviar = () => {
    const texto = pergunta.trim();
    if (texto.length < 3 || perguntar.isPending) return;

    setFalas((atuais) => [...atuais, { de: "pessoa", texto }]);
    setPergunta("");
    perguntar.mutate({ pergunta: texto });
  };

  return (
    <div className="flex h-[30rem] w-88 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-card bg-card p-5 shadow-overlay">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-info-soft text-info">
          <OrbitaAstro className="w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold text-card tracking-[-0.2px]">Astro</p>
          <p className="text-meta text-muted-foreground">
            {restantes === null
              ? "Assistente da escola"
              : `${restantes} pergunta(s) restante(s) hoje`}
          </p>
        </div>
      </div>

      {!ligado ? (
        <Aviso
          titulo="O Astro ainda não foi ligado"
          texto="A direção configura o modelo em Configurações. Sem isso ele não tem com quem conversar."
          acao={
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link to="/configuracoes" />}
            >
              Abrir Configurações
            </Button>
          }
        />
      ) : !disponivel ? (
        <Aviso
          titulo="Seu perfil não tem acesso"
          texto="A escola escolhe quais perfis podem perguntar ao Astro. Fale com a secretaria."
        />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {falas.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-control bg-muted px-3 py-2.5">
                <p className="text-corpo text-muted-foreground">
                  Pergunte sobre a escola em linguagem comum.
                </p>
                {/*
                  A regra de permissão dita na porta, não escondida no
                  contrato. É o que separa um assistente de um vazamento.
                */}
                <p className="text-meta text-muted-foreground">
                  O Astro responde dentro do que você já pode ver, e diz quando não tem o dado em
                  vez de estimar.
                </p>
              </div>
            ) : (
              falas.map((fala, indice) => (
                <div
                  // A conversa é só desta sessão e nunca reordena, então o
                  // índice basta e não há id para inventar.
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista só cresce no fim
                  key={indice}
                  className={
                    fala.de === "pessoa"
                      ? "self-end rounded-control bg-primary px-3 py-2 text-corpo text-primary-foreground"
                      : "self-start whitespace-pre-wrap rounded-control bg-muted px-3 py-2 text-corpo"
                  }
                >
                  {fala.texto}
                </div>
              ))
            )}

            {perguntar.isPending ? (
              <p className="self-start px-3 text-meta text-muted-foreground">O Astro está lendo…</p>
            ) : null}
            <div ref={fim} />
          </div>

          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2"
          >
            <Input
              ref={campo}
              value={pergunta}
              onChange={(evento) => setPergunta(evento.target.value)}
              placeholder="Quantos alunos estão em risco?"
              aria-label="Sua pergunta ao Astro"
              maxLength={500}
              disabled={perguntar.isPending}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar pergunta"
              disabled={perguntar.isPending || pergunta.trim().length < 3}
            >
              <SendHorizontal size={18} strokeWidth={1.8} aria-hidden />
            </Button>
          </form>

          {/*
            O consumo saiu da barra lateral e veio para cá.
            Ele pertence ao Astro, não à navegação: quem está gastando é esta
            caixa, e a informação a um clique de distância do gasto é a que
            alguém de fato olha.
          */}
          {uso ? (
            <div className="grid grid-cols-2 gap-2 border-border border-t pt-3">
              <Medida
                rotulo="Perguntas hoje"
                valor={`${inteiro(uso.perguntas.usadas)}/${inteiro(uso.perguntas.teto)}`}
              />
              <Medida
                rotulo="Tokens no mês"
                valor={
                  uso.tokens.teto === null
                    ? inteiro(uso.tokens.usados)
                    : `${inteiro(uso.tokens.usados)}/${inteiro(uso.tokens.teto)}`
                }
                hint={uso.tokens.teto === null ? "sem teto" : undefined}
              />
            </div>
          ) : null}

          <p className="text-meta text-muted-foreground">
            A conversa não fica guardada: some ao fechar a página.
          </p>
        </>
      )}
    </div>
  );
}

const inteiro = (n: number) => n.toLocaleString("pt-BR");

/** Um número do rodapé: rótulo em cima, valor embaixo. */
function Medida({ rotulo, valor, hint }: { rotulo: string; valor: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-bold text-meta text-muted-foreground">{rotulo}</p>
      <p className="font-extrabold text-apoio tabular-nums">
        {valor}
        {hint ? (
          <span className="ml-1 font-bold text-meta text-muted-foreground">{hint}</span>
        ) : null}
      </p>
    </div>
  );
}

function Aviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-2">
      <p className="font-bold text-corpo">{titulo}</p>
      <p className="text-corpo text-muted-foreground">{texto}</p>
      {acao}
    </div>
  );
}
