import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card } from "@educa-escola/ui/components/card";
import { Skeleton } from "@educa-escola/ui/components/skeleton";
import { EmptyState, ErrorState, PermissionState } from "@educa-escola/ui/integra/states";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { appOrbitaDe } from "@/lib/orbita-apps";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/apps/$appKey")({
  component: AppEmbutido,
});

/**
 * Quanto esperar o embutido dar sinal antes de oferecer a aba nova.
 *
 * Um app recusado por CSP não dispara `error` no iframe. Pior: o navegador
 * dispara `load` assim mesmo, na página de erro dele — então `load` sozinho
 * não distingue "abriu" de "foi recusado". Sem este prazo, a pessoa encara um
 * retângulo branco sem saber se está lento ou quebrado.
 */
const PRAZO_DE_CARGA_MS = 8000;

/**
 * O aviso que o Órbita manda quando pintou de verdade, por `postMessage`.
 *
 * É o único sinal confiável de que o embutido funcionou — daí ele valer mais
 * que o `load`. Enquanto o lado de lá não o enviar, `load` segue como palpite
 * otimista: o app aparece, e quem ficar com a área em branco tem o botão de
 * nova aba no cabeçalho.
 */
const AVISO_DE_PRONTO = "orbita:pronto";

type Estado = "pedindo" | "carregando" | "pronto" | "nao_embutiu" | "inalcancavel" | "recusado";

/** Quanto esperar o Órbita responder ao toque antes de desistir. */
const PRAZO_DO_TOQUE_MS = 5000;

/**
 * Bate na porta do Órbita antes de montar o iframe.
 *
 * É o que separa "o endereço não responde" de "respondeu e recusou ser
 * embutido" — duas falhas que o iframe mostra igual, como um retângulo branco.
 * `no-cors` devolve resposta opaca, que não dá para ler: o que interessa aqui
 * não é o conteúdo, é se a conexão aconteceu. Host fora do ar rejeita.
 *
 * Duas coisas que ele não pega: a recusa por CSP, que chega como conexão
 * bem-sucedida — para essa o sinal certo é o aperto de mão logo abaixo —, e o
 * host morto atrás de proxy corporativo, que responde a página de bloqueio do
 * proxy e passa por vivo. Ele acerta o caso que mais aparece em
 * desenvolvimento: o Órbita simplesmente não está no ar.
 */
async function respondeu(endereco: string): Promise<boolean> {
  try {
    await fetch(new URL(endereco).origin, {
      mode: "no-cors",
      signal: AbortSignal.timeout(PRAZO_DO_TOQUE_MS),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Um app do Órbita, aberto por dentro do Integra.
 *
 * A casca é daqui — barra lateral, ano letivo, conta. O conteúdo é de lá, e a
 * faixa em cima diz isso: ninguém deve achar que virou uma tela nativa da
 * escola, porque o suporte e os dados são do Órbita.
 */
function AppEmbutido() {
  const { appKey } = Route.useParams();
  const trpc = useTRPC();
  const app = appOrbitaDe(appKey);

  const [estado, setEstado] = useState<Estado>("pedindo");
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abrir = useMutation(trpc.orbita.openApp.mutationOptions());

  /**
   * A mutation devolve um objeto novo a cada render, e `mutateAsync` junto.
   * Guardá-lo num ref deixa `pedirEndereco` depender só do app — sem isso, o
   * efeito abaixo reexecutaria a cada render e pediria token em looping.
   */
  const pedirAoServidor = useRef(abrir.mutateAsync);
  useEffect(() => {
    pedirAoServidor.current = abrir.mutateAsync;
  });

  /**
   * Pede um endereço novo a cada montagem.
   *
   * O token vale segundos e é de uso único: guardar este endereço em cache ou
   * reusá-lo ao voltar para a aba entregaria um token já queimado.
   */
  const pedirEndereco = useCallback(
    async (embedded: boolean) => {
      // `app.key` e não o parâmetro cru da rota: o catálogo é quem diz se a
      // chave existe, e é dele que vem o tipo que o servidor aceita.
      if (!app) return null;

      setEstado("pedindo");
      setErro(null);
      try {
        const resultado = await pedirAoServidor.current({ appKey: app.key, embedded });
        return resultado.url;
      } catch (falha) {
        const mensagem = falha instanceof Error ? falha.message : "Não foi possível abrir o app.";
        setErro(mensagem);
        setEstado("recusado");
        return null;
      }
    },
    [app],
  );

  useEffect(() => {
    let vivo = true;

    pedirEndereco(true).then(async (endereco) => {
      if (!vivo || !endereco) return;

      if (!(await respondeu(endereco))) {
        if (!vivo) return;
        setUrl(endereco);
        setEstado("inalcancavel");
        return;
      }
      if (!vivo) return;

      setUrl(endereco);
      setEstado("carregando");

      prazo.current = setTimeout(() => {
        // `load` não dispara quando o navegador recusa o enquadramento, então
        // o silêncio é a única pista que temos.
        setEstado((atual) => (atual === "carregando" ? "nao_embutiu" : atual));
      }, PRAZO_DE_CARGA_MS);
    });

    return () => {
      vivo = false;
      if (prazo.current) clearTimeout(prazo.current);
    };
    // Só na montagem e na troca de app: `pedirEndereco` só muda quando o app
    // muda, e é o que garante um pedido por aba aberta, não um por render.
  }, [pedirEndereco]);

  /**
   * O aperto de mão do Órbita. Chega antes ou depois do `load`, e manda mais
   * que ele: só o app de lá sabe que pintou.
   */
  useEffect(() => {
    function aoReceber(evento: MessageEvent) {
      if (url && evento.origin !== new URL(url).origin) return;
      if (evento.data?.type !== AVISO_DE_PRONTO) return;
      if (prazo.current) clearTimeout(prazo.current);
      setEstado("pronto");
    }

    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [url]);

  async function emNovaAba() {
    const endereco = await pedirEndereco(false);
    if (endereco) window.open(endereco, "_blank", "noopener,noreferrer");
  }

  if (!app) {
    return (
      <Card>
        <EmptyState
          title="App desconhecido"
          description="Este app não faz parte do ecossistema, ou foi renomeado."
          action={
            <Button variant="secondary" nativeButton={false} render={<Link to="/apps" />}>
              Voltar aos apps
            </Button>
          }
        />
      </Card>
    );
  }

  const Icone = app.icon;

  return (
    <div className="flex min-h-[32rem] flex-1 flex-col gap-3">
      <div>
        <Link
          to="/apps"
          className="flex w-fit items-center gap-1.5 font-bold text-meta text-muted-foreground"
        >
          <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
          Apps
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <Icone size={18} strokeWidth={1.7} aria-hidden />
            <h1 className="font-extrabold text-sm">{app.nome}</h1>
            <span className="text-meta text-muted-foreground">{app.resumo}</span>
            {/* Dizer de onde vem o conteúdo: no dia em que quebrar, é o que
                faz a pessoa procurar o suporte certo. */}
            <Badge variant="secondary">Órbita</Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-8 px-3 text-meta"
            onClick={emNovaAba}
          >
            <ExternalLink size={14} strokeWidth={1.8} aria-hidden />
            Abrir em nova aba
          </Button>
        </header>

        <div className="relative min-h-0 flex-1 bg-muted">
          {estado === "recusado" ? (
            <div className="grid h-full place-items-center p-6">
              {erro?.includes("não está instalado") ? (
                <EmptyState
                  title={`${app.nome} não está instalado`}
                  description="Instale o app na aba Apps antes de abri-lo."
                  action={
                    <Button nativeButton={false} render={<Link to="/apps" />}>
                      Ver apps
                    </Button>
                  }
                />
              ) : erro?.includes("perfil") ? (
                <PermissionState
                  title="Seu perfil não abre este app"
                  description="Fale com a direção da escola se precisa de acesso."
                />
              ) : (
                <ErrorState
                  title="Não foi possível abrir"
                  description={erro ?? "Tente de novo em instantes."}
                  action={
                    <Button variant="secondary" onClick={() => window.location.reload()}>
                      Tentar de novo
                    </Button>
                  }
                />
              )}
            </div>
          ) : estado === "inalcancavel" ? (
            <div className="grid h-full place-items-center p-6">
              <ErrorState
                title="O Órbita não respondeu"
                description={
                  url
                    ? `Nada atende em ${new URL(url).host}. Ou a integração ainda não aponta para um Órbita no ar, ou ele está fora.`
                    : "Nada atende no endereço configurado para o Órbita."
                }
                action={
                  <Button variant="secondary" onClick={() => window.location.reload()}>
                    Tentar de novo
                  </Button>
                }
              />
            </div>
          ) : estado === "nao_embutiu" ? (
            <div className="grid h-full place-items-center p-6">
              <EmptyState
                title="Este app não abre aqui dentro"
                description="Alguns apps não funcionam embutidos. Ele abre em nova aba, já com a sua sessão."
                action={
                  <Button onClick={emNovaAba}>
                    <Maximize2 size={18} strokeWidth={1.7} aria-hidden />
                    Abrir em nova aba
                  </Button>
                }
              />
            </div>
          ) : null}

          {estado === "pedindo" || estado === "carregando" ? (
            <div className="absolute inset-0 flex flex-col gap-3 p-6" aria-hidden>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}

          {url && (estado === "carregando" || estado === "pronto") ? (
            <iframe
              src={url}
              title={`${app.nome} — Órbita`}
              className="size-full border-0"
              // Sem `allow-same-origin` o app não enxerga os próprios cookies
              // e nada carrega. O que fica de fora é o que ele não deve poder:
              // abrir janela sem gesto, navegar o topo, baixar sozinho.
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={() => {
                if (prazo.current) clearTimeout(prazo.current);
                setEstado("pronto");
              }}
            />
          ) : null}
        </div>
      </div>

      {/*
        DECISÃO-JOÃO: o embutido depende de coisas que não estão neste código.
        Quebra se: (1) os dois não estiverem sob o mesmo domínio-pai, o cookie
          de sessão do Órbita não atravessa e o app pede login dentro do
          iframe; (2) o CSP de lá não liberar `frame-ancestors` para este
          domínio, o navegador recusa — e como ele dispara `load` na própria
          página de erro, a área fica em branco sem avisar ninguém; (3) apps
          com seletor de arquivo, popup de OAuth ou arrastar-e-soltar costumam
          não funcionar embutidos, um a um.
        Fiz assim: o prazo de 8s cobre o caso de nada carregar, e o `load`
          serve de palpite otimista para o app aparecer hoje. A detecção só
          fica exata quando o Órbita mandar `postMessage({type:"orbita:pronto"})`
          ao terminar de pintar — o ouvinte já está aqui, esperando. É mais um
          item para a PR do lado de lá, junto com `frame-ancestors`.
        Alternativas: `crossSubDomainCookies` no Better Auth dos dois lados ·
          proxy reverso servindo o Órbita sob o domínio do Integra · abrir
          sempre em aba nova para os apps que não embutirem.
      */}
      <p className="text-meta text-muted-foreground">
        O conteúdo desta aba é do Órbita. Dados, histórico e suporte deste app ficam lá — o Integra
        só o mostra por dentro. Se a área acima ficar em branco, este app não abre embutido: use
        “Abrir em nova aba”.
      </p>
    </div>
  );
}
