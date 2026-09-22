import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plug, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { integerText } from "@/lib/format";
import { ORBITA_APPS, type OrbitaApp } from "@/lib/orbita-apps";
import type { RouterOutputs } from "@/utils/trpc";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/apps/")({
  component: Apps,
});

type Panorama = RouterOutputs["orbita"]["overview"];
type AppState = Panorama["apps"][number];

/**
 * Os apps do ecossistema Órbita, por dentro do Integra.
 *
 * O dado dos apps mora lá; aqui mora o vínculo e o estado da instalação. A
 * regra que rege esta tela é uma: **botão que gasta dinheiro não pode ser
 * mudo.** Instalar debita Stars da conta da escola, então o custo aparece no
 * card, a confirmação repete o valor, e o servidor recusa quando o saldo não
 * cobre.
 */
function Apps() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState<AppState | null>(null);

  const panorama = useQuery(trpc.orbita.overview.queryOptions());

  /**
   * Desinstalar tira o vínculo, não o dado.
   *
   * O que o app produziu continua no Órbita — o que sai daqui é a aba e a
   * cobrança mensal. Por isso não há confirmação destrutiva: a ação é
   * reversível reinstalando, e o custo de ativação já foi pago.
   */
  const remover = useMutation(
    trpc.orbita.remove.mutationOptions({
      onSuccess: () => {
        toast.success("App desinstalado. O que ele produziu continua no Órbita.");
        queryClient.invalidateQueries();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const instalar = useMutation(
    trpc.orbita.install.mutationOptions({
      onSuccess: (resultado) => {
        toast.success("Instalação iniciada. O Órbita ativa e avisa quando terminar.");
        setConfirmando(null);
        queryClient.invalidateQueries();
        return resultado;
      },
      onError: (error) => {
        toast.error(error.message);
        setConfirmando(null);
      },
    }),
  );

  if (panorama.error) {
    return (
      <Card>
        {panorama.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="Os apps do ecossistema são da direção e da secretaria."
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar os apps"
            description={panorama.error.message}
            action={
              <Button variant="secondary" onClick={() => panorama.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        )}
      </Card>
    );
  }

  if (panorama.isLoading || !panorama.data) {
    return (
      <Card>
        <ListSkeleton rows={6} />
      </Card>
    );
  }

  const data = panorama.data;
  const estadoDe = new Map(data.apps.map((app) => [app.appKey, app]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* Voltou a ser texto: a assinatura passou a viver na barra lateral,
              e duas marcas na mesma tela deixam de destacar qualquer coisa. O
              rótulo continua dizendo que o catálogo é do ecossistema, que é o
              que esta tela precisa informar. */}
          <CardEyebrow>Ecossistema Órbita</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Apps</h1>
          <p className="text-corpo text-muted-foreground">
            {data.installedCount === 0
              ? `${ORBITA_APPS.length} apps disponíveis para a escola`
              : `${integerText(data.installedCount)} instalados · ${integerText(ORBITA_APPS.length - data.installedCount)} disponíveis`}
          </p>
        </div>
        <Saldo balance={data.balance} />
      </div>

      {!data.connected ? <Conectar /> : null}

      {confirmando ? (
        <Confirmacao
          estado={confirmando}
          saldo={data.balance}
          enviando={instalar.isPending}
          onFechar={() => setConfirmando(null)}
          onInstalar={() =>
            instalar.mutate({
              appKey: confirmando.appKey,
              expectedSetupCost: confirmando.cost?.setupCost ?? 0,
            })
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORBITA_APPS.map((app) => (
          <CardApp
            key={app.key}
            app={app}
            estado={estadoDe.get(app.key)}
            conectada={data.connected}
            onInstalar={setConfirmando}
            aoRemover={(appKey) => remover.mutate({ appKey })}
            removendo={remover.isPending}
          />
        ))}
      </div>

      <p className="text-meta text-muted-foreground">
        Os valores vêm do catálogo do Órbita e podem mudar lá sem alteração aqui. O que a escola
        pagou fica gravado no momento da instalação — o histórico precisa dizer o preço do dia, não
        o de hoje.
      </p>
    </>
  );
}

function Saldo({ balance }: { balance: Panorama["balance"] }) {
  if (!balance) {
    return (
      <div className="flex items-center gap-3 rounded-card bg-card px-5 py-4">
        <Star size={18} strokeWidth={1.7} className="text-muted-foreground" aria-hidden />
        <div>
          <div className="font-bold text-corpo">Saldo indisponível</div>
          <div className="text-meta text-muted-foreground">Conecte a escola ao Órbita</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 rounded-card bg-card px-5 py-4">
      <div>
        <CardEyebrow>Saldo da escola</CardEyebrow>
        <p className="mt-1 font-extrabold text-2xl tabular-nums tracking-[-0.6px]">
          {integerText(balance.balance)} <span className="text-warning">★</span>
        </p>
      </div>
      {/* Bônus separado: há ação no Órbita que não aceita saldo de bônus, e um
          número só faria a escola contar com dinheiro que não pode usar ali. */}
      <div className="border-border border-l pl-5">
        <CardEyebrow>Bônus</CardEyebrow>
        <p className="mt-1 font-extrabold text-base text-muted-foreground tabular-nums">
          {integerText(balance.bonusBalance)} ★
        </p>
      </div>
    </div>
  );
}

/** A escola ainda não tem conta no Órbita: sem ela, nada instala. */
function Conectar() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState("");

  const conectar = useMutation(
    trpc.orbita.connect.mutationOptions({
      onSuccess: () => {
        toast.success("Escola conectada ao Órbita.");
        queryClient.invalidateQueries();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-control bg-accent text-accent-foreground">
          <Plug size={20} strokeWidth={1.7} aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Conecte a escola ao Órbita</h2>
          <p className="mt-1 text-corpo text-muted-foreground">
            Os apps rodam na conta da escola no Órbita, e é dela que as Stars saem. A conexão é
            feita uma vez, pela direção.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="org-orbita">Identificador da organização no Órbita</Label>
          <Input
            id="org-orbita"
            value={orgId}
            placeholder="org_..."
            onChange={(evento) => setOrgId(evento.target.value)}
          />
        </div>
        <Button
          disabled={conectar.isPending || orgId.trim().length === 0}
          onClick={() => conectar.mutate({ orbitaOrganizationId: orgId.trim() })}
        >
          {conectar.isPending ? "Conectando…" : "Conectar"}
        </Button>
      </div>

      {/*
        DECISÃO-JOÃO: como a escola vira uma organização no Órbita.
        Quebra se: hoje não existe porta máquina-a-máquina lá, então a
          organização precisa ser criada à mão e o id colado aqui. Em produção
          isso não escala nem é aceitável pedir à direção de uma escola.
        Fiz assim: campo de texto, para a tela fechar de ponta a ponta e os
          testes rodarem sem rede.
        Alternativas: provisionamento por chamada, no ato · login único, em que
          conectar é autorizar e o id vem do próprio fluxo.
      */}
      <p className="text-meta text-muted-foreground">
        Por enquanto o identificador é informado à mão. O provisionamento automático depende de uma
        porta do lado do Órbita que ainda não existe.
      </p>
    </Card>
  );
}

function CardApp({
  app,
  estado,
  conectada,
  onInstalar,
  aoRemover,
  removendo,
}: {
  app: OrbitaApp;
  estado: AppState | undefined;
  conectada: boolean;
  onInstalar: (estado: AppState) => void;
  aoRemover?: (appKey: OrbitaApp["key"]) => void;
  removendo?: boolean;
}) {
  const Icone = app.icon;
  const status = estado?.status ?? "disponivel";
  const instalado = status === "instalado";
  const instalando = status === "instalando";
  const falhou = status === "falhou";

  return (
    <article
      className={
        instalado
          ? "flex flex-col gap-2.5 rounded-card border border-border bg-card p-4"
          : "flex flex-col gap-2.5 rounded-card border border-transparent bg-muted p-4"
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            instalado
              ? "grid size-10 place-items-center rounded-control bg-accent text-accent-foreground"
              : "grid size-10 place-items-center rounded-control bg-secondary text-secondary-foreground"
          }
        >
          <Icone size={19} strokeWidth={1.7} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-extrabold text-sm leading-tight">{app.name}</h3>
          <p className="text-meta text-muted-foreground">{app.summary}</p>
        </div>
      </div>

      <p className="flex-1 text-meta text-muted-foreground leading-relaxed">{app.descricao}</p>

      {falhou && estado?.lastError ? (
        <p className="text-danger text-meta">{estado.lastError}</p>
      ) : null}

      {instalado || instalando ? (
        <div className="flex items-center justify-between gap-2">
          <Badge variant={instalando ? "info" : "success"}>
            {instalando ? "Instalando…" : "Instalado"}
          </Badge>
          {instalando ? (
            <Button size="sm" disabled className="min-h-8 px-3 text-meta">
              Aguarde
            </Button>
          ) : (
            <Button
              size="sm"
              className="min-h-8 px-3 text-meta"
              // O alvo é uma navegação, então o elemento é um link de
              // verdade. `nativeButton={false}` diz isso ao Base UI: sem
              // ele o primitivo espera um <button> e reclama em tempo de
              // execução, com razão — semântica de botão num <a> confunde
              // leitor de tela e quebra "abrir em nova aba".
              nativeButton={false}
              render={<Link to="/apps/$appKey" params={{ appKey: app.key }} />}
            >
              Abrir
            </Button>
          )}
          {/* Desinstalar não apaga o dado do app: ele mora no Órbita, e o que
              sai daqui é o vínculo. Por isso é uma ação discreta ao lado de
              "Abrir", e não um botão vermelho pedindo para ser clicado. */}
          {instalado && aoRemover ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Desinstalar ${app.name}`}
              onClick={() => aoRemover(app.key)}
              disabled={removendo}
            >
              <Trash2 size={16} strokeWidth={1.8} aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <Custo estado={estado} />
          <Button
            size="sm"
            variant={falhou ? "warning" : "secondary"}
            className="min-h-8 px-3 text-meta"
            disabled={!conectada || !estado || !estado.affordable}
            onClick={() => estado && onInstalar(estado)}
          >
            {falhou ? "Tentar de novo" : "Instalar"}
          </Button>
        </>
      )}
    </article>
  );
}

function Custo({ estado }: { estado: AppState | undefined }) {
  if (!estado?.cost) {
    return <span className="text-meta text-muted-foreground">Preço indisponível</span>;
  }

  const { setupCost, monthlyCost, unitLabel } = estado.cost;
  const recorrente = unitLabel ? `${monthlyCost} ${unitLabel}` : `${monthlyCost}/mês`;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-meta text-secondary-foreground">
        <span className="text-warning">★</span>{" "}
        {setupCost === 0 ? "sem ativação" : `${setupCost} na ativação`} · {recorrente}
      </span>
      {!estado.affordable ? (
        <span className="font-bold text-danger text-meta">Saldo não cobre a ativação</span>
      ) : null}
    </div>
  );
}

/**
 * A confirmação repete o valor e mostra o saldo depois.
 *
 * "120 ★" é abstrato; "sobram 1.120" é a informação que a direção usa para
 * decidir. Painel inline e não diálogo — o design system não tem Dialog, e
 * criar um para isto seria primitivo novo por uma tela.
 */
function Confirmacao({
  estado,
  saldo,
  enviando,
  onFechar,
  onInstalar,
}: {
  estado: AppState;
  saldo: Panorama["balance"];
  enviando: boolean;
  onFechar: () => void;
  onInstalar: () => void;
}) {
  const app = ORBITA_APPS.find((item) => item.key === estado.appKey);
  const setupCost = estado.cost?.setupCost ?? 0;

  /*
   * O saldo comprado é gasto primeiro; o bônus só entra no que sobrar. Somar
   * os dois num número só fazia a tela dizer "saldo depois: 1.220" ao lado de
   * um topo que mostra 1.240 — quem comparasse calcularia um custo de 20 ★
   * em vez de 120.
   */
  const gastoDoSaldo = saldo ? Math.min(saldo.balance, setupCost) : 0;
  const gastoDoBonus = setupCost - gastoDoSaldo;
  const saldoDepois = saldo ? saldo.balance - gastoDoSaldo : null;
  const bonusDepois = saldo ? saldo.bonusBalance - gastoDoBonus : null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardEyebrow>Instalar</CardEyebrow>
        <h2 className="font-extrabold text-base tracking-[-0.2px]">{app?.name ?? estado.appKey}</h2>
        <p className="text-corpo text-muted-foreground">{app?.descricao}</p>
      </div>

      <dl className="flex flex-col gap-0 rounded-card bg-muted px-4">
        <Linha label="Ativação, agora">{setupCost} ★</Linha>
        <Linha label="A partir do próximo ciclo">
          {estado.cost?.unitLabel
            ? `${estado.cost.monthlyCost} ★ ${estado.cost.unitLabel}`
            : `${estado.cost?.monthlyCost ?? 0} ★ por mês`}
        </Linha>
        {saldoDepois !== null ? (
          <Linha label="Saldo depois da ativação">
            <span className={saldoDepois < 0 ? "text-danger" : "text-success"}>
              {integerText(saldoDepois)} ★
            </span>
          </Linha>
        ) : null}
        {gastoDoBonus > 0 && bonusDepois !== null ? (
          <Linha label="Sai do bônus">
            {integerText(gastoDoBonus)} ★ · restam {integerText(bonusDepois)} ★
          </Linha>
        ) : null}
      </dl>

      <Alert>
        <AlertTitle>A cobrança acontece no Órbita</AlertTitle>
        <AlertDescription>
          Se o preço tiver mudado lá desde que esta tela carregou, a instalação é recusada e você vê
          o valor novo — nada é debitado às escuras.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button disabled={enviando} onClick={onInstalar}>
          {enviando ? "Instalando…" : `Instalar e debitar ${setupCost} ★`}
        </Button>
      </div>
    </Card>
  );
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b py-3 last:border-b-0">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="font-extrabold text-sm tabular-nums">{children}</dd>
    </div>
  );
}
