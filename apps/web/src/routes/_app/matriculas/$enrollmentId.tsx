import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Textarea } from "@educa-escola/ui/components/textarea";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Copy, Pencil, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IdentificacaoFacial } from "@/components/identificacao-facial";
import {
  dataCivil,
  dataHora,
  motivoCancelamento,
  parentesco,
  situacaoEnrollment,
  situacaoLink,
  telefone,
  turno,
} from "@/lib/format";
import { dataParaISO, idadeEm, isoParaData, mascararCelular, mascararData } from "@/lib/masks";
import type { RouterOutputs } from "@/utils/trpc";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/matriculas/$enrollmentId")({
  component: DetalheMatricula,
});

const SEM_TURMA = "SEM_TURMA";

/** Rótulo de cada finalidade de consentimento. */
const FINALIDADES: Record<string, string> = {
  termos_matricula: "Termos da matrícula",
  uso_imagem: "Uso de imagem",
  comunicacao: "Comunicação",
  biometria: "Identificação facial",
};

const TURNOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

const PARENTESCOS = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avó ou avô" },
  { value: "responsavel_legal", label: "Responsável legal" },
  { value: "outro", label: "Outro" },
] as const;

const MOTIVOS = [
  { value: "transferencia_outra_escola", label: "Transferência para outra escola" },
  { value: "mudanca_de_cidade", label: "Mudança de cidade" },
  { value: "desistencia", label: "Desistência" },
  { value: "dados_incorretos", label: "Dados incorretos" },
  { value: "outro", label: "Outro" },
] as const;

/** Texto de cada evento da trilha, em português de escola. */
const EVENTOS: Record<string, string> = {
  criada: "Matrícula criada",
  editada: "Matrícula editada",
  link_gerado: "Link gerado",
  link_enviado: "Link enviado ao responsável",
  link_revogado: "Link anterior revogado",
  conferencia_ok: "Conferência aceita",
  conferencia_falha: "Conferência recusada",
  ficha_enviada: "Ficha enviada pela família",
  confirmada: "Matrícula confirmada",
  cancelada: "Matrícula cancelada",
  renovada: "Renovada para o ano seguinte",
  expirada: "Prazo expirado",
  foto_cadastrada: "Foto cadastrada",
  foto_revogada: "Identificação facial revogada",
  foto_aberta: "Foto do aluno aberta",
};

type Painel = "nenhum" | "editar" | "confirmar" | "cancelar" | "renovar";

function DetalheMatricula() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { enrollmentId } = Route.useParams();
  const [painel, setPainel] = useState<Painel>("nenhum");
  const [linkNovo, setLinkNovo] = useState<string | null>(null);

  const matricula = useQuery(trpc.enrollment.byId.queryOptions({ id: enrollmentId }));
  const turmas = useQuery(trpc.classroom.list.queryOptions());

  const aoMudar = (mensagem: string) => () => {
    toast.success(mensagem);
    setPainel("nenhum");
    queryClient.invalidateQueries();
  };
  const aoFalhar = (erro: { message: string }) => toast.error(erro.message);

  const editar = useMutation(
    trpc.enrollment.edit.mutationOptions({
      onSuccess: aoMudar("Matrícula atualizada."),
      onError: aoFalhar,
    }),
  );
  const confirmar = useMutation(
    trpc.enrollment.confirm.mutationOptions({
      onSuccess: aoMudar("Matrícula confirmada. O aluno já aparece na chamada da turma."),
      onError: aoFalhar,
    }),
  );
  const cancelar = useMutation(
    trpc.enrollment.cancel.mutationOptions({
      onSuccess: aoMudar("Matrícula cancelada."),
      onError: aoFalhar,
    }),
  );
  const renovar = useMutation(
    trpc.enrollment.renew.mutationOptions({
      onSuccess: (resultado) => {
        setLinkNovo(resultado.url);
        toast.success("Renovação criada. Copie o link e mande ao responsável.");
        setPainel("nenhum");
        queryClient.invalidateQueries();
      },
      onError: aoFalhar,
    }),
  );
  const reemitir = useMutation(
    trpc.enrollment.resendLink.mutationOptions({
      onSuccess: (resultado) => {
        setLinkNovo(resultado.url);
        toast.success("Link novo emitido. O anterior deixou de valer.");
        queryClient.invalidateQueries();
      },
      onError: aoFalhar,
    }),
  );

  if (matricula.error) {
    return (
      <Card>
        {matricula.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="Matrículas são da secretaria e da direção."
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar a matrícula"
            description={matricula.error.message}
            action={
              <Button variant="secondary" render={<Link to="/matriculas" />}>
                Voltar à fila
              </Button>
            }
          />
        )}
      </Card>
    );
  }

  if (matricula.isLoading || !matricula.data) {
    return (
      <Card>
        <ListSkeleton rows={5} />
      </Card>
    );
  }

  const dados = matricula.data;
  const situacao = situacaoEnrollment(dados.enrollment.status);
  const pendente = dados.enrollment.status === "pendente";
  const fichaEntregue = dados.invite?.status === "ficha_entregue";
  const turmasDoAno = (turmas.data ?? []).filter(
    (turma) => turma.academicYear === dados.enrollment.academicYear,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <Card className="flex flex-col gap-5">
        <div>
          <Link
            to="/matriculas"
            className="flex w-fit items-center gap-1.5 font-bold text-meta text-muted-foreground"
          >
            <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
            Matrículas
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback>{initialsOf(dados.studentName)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-extrabold text-xl tracking-[-0.4px]">{dados.studentName}</h1>
                <p className="flex flex-wrap items-center gap-2 text-corpo text-muted-foreground">
                  <span className="tabular-nums">{dados.registration}</span>
                  <span aria-hidden>·</span>
                  <span>{dados.classroomName ?? "Turma a definir"}</span>
                  <span aria-hidden>·</span>
                  <span>{turno(dados.enrollment.shift)}</span>
                  {dados.classCode ? (
                    <Badge variant="neutral" title={dados.classLabel}>
                      {dados.classCode}
                    </Badge>
                  ) : null}
                </p>
              </div>
            </div>
            <Badge variant={situacao.tone}>{situacao.label}</Badge>
          </div>
        </div>

        {fichaEntregue && pendente ? (
          <Alert variant="success">
            <Check size={18} strokeWidth={1.7} aria-hidden />
            <AlertTitle>
              A família enviou a ficha em {dataHora(dados.invite?.consumedAt)}
            </AlertTitle>
            <AlertDescription>
              Falta a confirmação da secretaria para o aluno entrar na turma.
            </AlertDescription>
          </Alert>
        ) : null}

        {dados.enrollment.status === "cancelada" ? (
          <Alert variant="destructive">
            <X size={18} strokeWidth={1.7} aria-hidden />
            <AlertTitle>
              Cancelada
              {dados.enrollment.cancelReason
                ? ` · ${motivoCancelamento(dados.enrollment.cancelReason)}`
                : ""}
            </AlertTitle>
            <AlertDescription>
              {dados.enrollment.cancelledOn
                ? `Efeito a partir de ${dataCivil(dados.enrollment.cancelledOn)}.`
                : "Sem data de efeito registrada."}
            </AlertDescription>
          </Alert>
        ) : null}

        {linkNovo ? <LinkEmitido url={linkNovo} onFechar={() => setLinkNovo(null)} /> : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Ficha</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Dado rotulo="Nascimento" valor={dataCivil(dados.birthDate)} />
            <Dado rotulo="Ano letivo" valor={String(dados.enrollment.academicYear)} />
            <Dado
              rotulo="Tipo"
              valor={dados.enrollment.kind === "rematricula" ? "Rematrícula" : "Matrícula"}
            />
          </dl>
        </section>

        <section className="flex flex-col gap-3 border-border border-t pt-5">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Responsáveis</h2>
          {dados.guardians.length === 0 ? (
            <p className="text-corpo text-muted-foreground">Nenhum responsável vinculado.</p>
          ) : (
            dados.guardians.map((guardian) => (
              <div key={guardian.id} className="flex flex-wrap items-center justify-between gap-3">
                <dl className="grid flex-1 gap-4 sm:grid-cols-3">
                  <Dado rotulo="Nome" valor={guardian.name} />
                  <Dado rotulo="Parentesco" valor={parentesco(guardian.relationship)} />
                  <Dado rotulo="Celular" valor={telefone(guardian.phoneE164)} />
                </dl>
                {guardian.isLegal ? <Badge variant="info">Responsável legal</Badge> : null}
              </div>
            ))
          )}
        </section>

        <section className="flex flex-col gap-3 border-border border-t pt-5">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Consentimentos</h2>
          {dados.consents.length === 0 ? (
            <p className="text-corpo text-muted-foreground">
              Nada registrado ainda — o aceite acontece quando a família envia a ficha.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dados.consents.map((consent) => (
                <li
                  key={consent.id}
                  className="flex items-center justify-between gap-3 rounded-field bg-muted px-4 py-3"
                >
                  <div>
                    <div className="font-bold text-corpo">
                      {FINALIDADES[consent.purpose] ?? consent.purpose}
                    </div>
                    <div className="text-meta text-muted-foreground">
                      versão {consent.termVersion} · {dataHora(consent.grantedAt)} ·{" "}
                      {consent.actorName}
                    </div>
                  </div>
                  <Badge variant={consent.granted ? "success" : "neutral"}>
                    {consent.granted ? "Aceito" : "Recusado"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4 border-border border-t pt-5">
          {painel === "nenhum" ? (
            <div className="flex flex-wrap gap-3">
              {pendente ? (
                <Button onClick={() => setPainel("confirmar")}>Confirmar matrícula</Button>
              ) : null}
              {dados.enrollment.status !== "cancelada" ? (
                <Button variant="secondary" onClick={() => setPainel("editar")}>
                  <Pencil size={18} strokeWidth={1.7} aria-hidden />
                  Editar
                </Button>
              ) : null}
              {dados.enrollment.status === "ativa" ? (
                <Button variant="secondary" onClick={() => setPainel("renovar")}>
                  <RefreshCw size={18} strokeWidth={1.7} aria-hidden />
                  Renovar para {dados.enrollment.academicYear + 1}
                </Button>
              ) : null}
              {dados.enrollment.status !== "cancelada" ? (
                <Button variant="warning" onClick={() => setPainel("cancelar")}>
                  Cancelar matrícula
                </Button>
              ) : null}
            </div>
          ) : null}

          {painel === "editar" ? (
            <PainelEditar
              dados={dados}
              turmas={turmasDoAno}
              enviando={editar.isPending}
              onFechar={() => setPainel("nenhum")}
              onSalvar={(valores) => editar.mutate({ id: enrollmentId, ...valores })}
            />
          ) : null}

          {painel === "confirmar" ? (
            <PainelConfirmar
              turmas={turmasDoAno}
              turmaAtual={dados.enrollment.classroomId}
              enviando={confirmar.isPending}
              onFechar={() => setPainel("nenhum")}
              onConfirmar={(classroomId) => confirmar.mutate({ id: enrollmentId, classroomId })}
            />
          ) : null}

          {painel === "cancelar" ? (
            <PainelCancelar
              enviando={cancelar.isPending}
              ativa={dados.enrollment.status === "ativa"}
              onFechar={() => setPainel("nenhum")}
              onCancelar={(valores) => cancelar.mutate({ id: enrollmentId, ...valores })}
            />
          ) : null}

          {painel === "renovar" ? (
            <PainelRenovar
              proximoAno={dados.enrollment.academicYear + 1}
              enviando={renovar.isPending}
              onFechar={() => setPainel("nenhum")}
              onRenovar={(valores) => renovar.mutate({ id: enrollmentId, ...valores })}
            />
          ) : null}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <IdentificacaoFacial studentId={dados.enrollment.studentId} enrollmentId={enrollmentId} />

        <Card className="flex flex-col gap-4">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Link de confirmação</h2>
          {dados.invite ? (
            <dl className="flex flex-col gap-2.5">
              <Linha rotulo="Situação">
                <Badge variant={situacaoLink(dados.invite.status).tone}>
                  {situacaoLink(dados.invite.status).label}
                </Badge>
              </Linha>
              <Linha rotulo="Emitido">{dataHora(dados.invite.createdAt)}</Linha>
              <Linha rotulo="Vence">{dataHora(dados.invite.expiresAt)}</Linha>
              <Linha rotulo="Tentativas">{String(dados.invite.attempts)}</Linha>
            </dl>
          ) : (
            <p className="text-corpo text-muted-foreground">Nenhum link emitido.</p>
          )}

          <p className="text-meta text-muted-foreground">
            O endereço só aparece na emissão. Para mandar de novo, reemita — o link anterior deixa
            de valer no mesmo instante.
          </p>

          {pendente ? (
            <Button
              variant="secondary"
              disabled={reemitir.isPending}
              onClick={() => reemitir.mutate({ id: enrollmentId, expiryDays: 7 })}
            >
              {reemitir.isPending ? "Emitindo…" : "Reemitir link"}
            </Button>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Linha do tempo</h2>
          <ol className="flex flex-col">
            {dados.events.map((evento, indice) => (
              <li key={evento.id} className="grid grid-cols-[20px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      indice === 0
                        ? "mt-1.5 size-2.5 rounded-full border-2 border-primary bg-accent"
                        : "mt-1.5 size-2.5 rounded-full border-2 border-border bg-secondary"
                    }
                    aria-hidden
                  />
                  {indice < dados.events.length - 1 ? (
                    <span className="min-h-4 w-0.5 flex-1 bg-border" aria-hidden />
                  ) : null}
                </div>
                <div className="pb-4">
                  <div className="font-bold text-corpo">{EVENTOS[evento.type] ?? evento.type}</div>
                  <div className="text-meta text-muted-foreground">
                    {dataHora(evento.occurredAt)}
                    {evento.actor === "responsavel" ? " · responsável" : ""}
                  </div>
                  <Alteracoes payload={evento.payload} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]">
        {rotulo}
      </dt>
      <dd className="font-bold text-corpo">{valor}</dd>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-meta text-muted-foreground">{rotulo}</dt>
      <dd className="font-bold text-apoio">{children}</dd>
    </div>
  );
}

function LinkEmitido({ url, onFechar }: { url: string; onFechar: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-muted p-4">
      <span className="font-bold text-meta text-secondary-foreground">
        Endereço do link — copie agora, não aparece de novo
      </span>
      <code className="break-all text-apoio">{url}</code>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast.success("Link copiado.");
          }}
        >
          <Copy size={16} strokeWidth={1.7} aria-hidden />
          Copiar
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Já copiei
        </Button>
      </div>
    </div>
  );
}

/**
 * Painel inline em vez de diálogo.
 *
 * O design system não tem Dialog, e criar um só para isto seria um primitivo
 * novo para uma ação que cabe dentro do próprio card.
 */
function PainelConfirmar({
  turmas,
  turmaAtual,
  enviando,
  onFechar,
  onConfirmar,
}: {
  turmas: { id: string; name: string }[];
  turmaAtual: string | null;
  enviando: boolean;
  onFechar: () => void;
  onConfirmar: (classroomId: string | null) => void;
}) {
  const [turmaId, setTurmaId] = useState(turmaAtual ?? SEM_TURMA);

  return (
    <div className="flex flex-col gap-4 rounded-card bg-muted p-5">
      <h3 className="font-extrabold text-base tracking-[-0.2px]">Confirmar matrícula</h3>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="turma-confirmacao">Turma</Label>
        <Select
          items={[
            { value: SEM_TURMA, label: "Escolha a turma" },
            ...turmas.map((turma) => ({ value: turma.id, label: turma.name })),
          ]}
          value={turmaId}
          onValueChange={(valor) => setTurmaId(valor ?? SEM_TURMA)}
        >
          <SelectTrigger id="turma-confirmacao">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_TURMA}>Escolha a turma</SelectItem>
            {turmas.map((turma) => (
              <SelectItem key={turma.id} value={turma.id}>
                {turma.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-meta text-muted-foreground">
        Ao confirmar, o aluno passa a constar na chamada e na grade de notas dessa turma.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button
          disabled={enviando || turmaId === SEM_TURMA}
          onClick={() => onConfirmar(turmaId === SEM_TURMA ? null : turmaId)}
        >
          {enviando ? "Confirmando…" : "Confirmar matrícula"}
        </Button>
      </div>
    </div>
  );
}

function PainelCancelar({
  enviando,
  ativa,
  onFechar,
  onCancelar,
}: {
  enviando: boolean;
  ativa: boolean;
  onFechar: () => void;
  onCancelar: (valores: {
    reason: (typeof MOTIVOS)[number]["value"];
    note: string | null;
    effectiveOn: string;
  }) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState<(typeof MOTIVOS)[number]["value"]>(
    "transferencia_outra_escola",
  );
  const [note, setNote] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(hoje);

  return (
    <div className="flex flex-col gap-4 rounded-card bg-warning-soft p-5">
      <h3 className="font-extrabold text-base tracking-[-0.2px]">Cancelar matrícula</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motivo">Motivo</Label>
          <Select
            items={MOTIVOS.map((o) => ({ value: o.value, label: o.label }))}
            value={reason}
            onValueChange={(valor) => setReason(valor as (typeof MOTIVOS)[number]["value"])}
          >
            <SelectTrigger id="motivo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((motivo) => (
                <SelectItem key={motivo.value} value={motivo.value}>
                  {motivo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="efeito">Data de efeito</Label>
          <Input
            id="efeito"
            type="date"
            value={effectiveOn}
            onChange={(event) => setEffectiveOn(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Textarea
          id="observacao"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Contexto que ajude quem ler isto depois."
        />
      </div>
      {ativa ? (
        <p className="text-meta text-warning">
          O aluno sai da chamada a partir dessa data. Notas e faltas já lançadas ficam preservadas.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button
          variant="destructive"
          disabled={enviando}
          onClick={() => onCancelar({ reason, note: note.trim() || null, effectiveOn })}
        >
          {enviando ? "Cancelando…" : "Cancelar matrícula"}
        </Button>
      </div>
    </div>
  );
}

function PainelRenovar({
  proximoAno,
  enviando,
  onFechar,
  onRenovar,
}: {
  proximoAno: number;
  enviando: boolean;
  onFechar: () => void;
  onRenovar: (valores: { academicYear: number; expiryDays: number }) => void;
}) {
  const [prazo, setPrazo] = useState("7");

  return (
    <div className="flex flex-col gap-4 rounded-card bg-muted p-5">
      <h3 className="font-extrabold text-base tracking-[-0.2px]">Renovar para {proximoAno}</h3>
      <p className="text-corpo text-muted-foreground">
        A ficha vem preenchida com os dados deste ano. A família só confere o que mudou.
      </p>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="prazo-renovacao">Prazo de confirmação (dias)</Label>
        <Input
          id="prazo-renovacao"
          type="number"
          value={prazo}
          onChange={(event) => setPrazo(event.target.value)}
        />
      </div>
      <p className="text-meta text-muted-foreground">
        A turma não é sugerida pelo resultado do ano: o fechamento de período ainda não existe e a
        turma não guarda série. A escolha fica com a secretaria, na confirmação.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button
          disabled={enviando}
          onClick={() => onRenovar({ academicYear: proximoAno, expiryDays: Number(prazo) })}
        >
          {enviando ? "Criando…" : "Criar e emitir link"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Edição inline da matrícula.
 *
 * Manda ao servidor só o que mudou — campo intocado sai como `undefined`, e o
 * service só registra na trilha o que de fato diferiu. Assim a linha do tempo
 * não enche de "editada" sem alteração nenhuma.
 */
function PainelEditar({
  dados,
  turmas,
  enviando,
  onFechar,
  onSalvar,
}: {
  dados: RouterOutputs["enrollment"]["byId"];
  turmas: { id: string; name: string }[];
  enviando: boolean;
  onFechar: () => void;
  onSalvar: (valores: {
    student?: { name?: string; birthDate?: string };
    classroomId?: string;
    shift?: "manha" | "tarde" | "noite";
    guardian?: {
      id: string;
      name?: string;
      relationship?: "mae" | "pai" | "avo" | "responsavel_legal" | "outro";
      phoneE164?: string;
      email?: string | null;
    };
  }) => void;
}) {
  const legal = dados.guardians.find((item) => item.isLegal) ?? dados.guardians[0];

  const [nome, setNome] = useState(dados.studentName);
  const [nascimento, setNascimento] = useState(isoParaData(dados.birthDate));
  const [turmaId, setTurmaId] = useState(dados.enrollment.classroomId ?? "");
  const [turnoAtual, setTurnoAtual] = useState(dados.enrollment.shift);
  const [respNome, setRespNome] = useState(legal?.name ?? "");
  const [respParentesco, setRespParentesco] = useState(legal?.relationship ?? "responsavel_legal");
  const [celular, setCelular] = useState(telefone(legal?.phoneE164));
  const [email, setEmail] = useState(legal?.email ?? "");

  const nascimentoISO = dataParaISO(nascimento);
  const idade = idadeEm(nascimentoISO);
  const dataInvalida = nascimento.replace(/\D/g, "").length === 8 && !nascimentoISO;

  const trocouTurma = turmaId && turmaId !== dados.enrollment.classroomId;

  return (
    <div className="flex flex-col gap-4 rounded-card bg-muted p-5">
      <h3 className="font-extrabold text-base tracking-[-0.2px]">Editar matrícula</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ed-nome">Nome do aluno</Label>
          <Input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ed-nasc">Data de nascimento</Label>
          <div className="relative">
            <Input
              id="ed-nasc"
              inputMode="numeric"
              maxLength={10}
              placeholder="dd/mm/aaaa"
              className="pr-20 tabular-nums"
              value={nascimento}
              onChange={(e) => setNascimento(mascararData(e.target.value))}
            />
            {idade !== null ? (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 font-bold text-meta text-muted-foreground">
                {idade} anos
              </span>
            ) : null}
          </div>
          {dataInvalida ? (
            <p className="text-danger text-meta">Esta data não existe no calendário.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ed-turma">Turma</Label>
          <Select
            items={turmas.map((turma) => ({ value: turma.id, label: turma.name }))}
            value={turmaId}
            onValueChange={(valor) => setTurmaId(valor ?? "")}
          >
            <SelectTrigger id="ed-turma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {turmas.map((turma) => (
                <SelectItem key={turma.id} value={turma.id}>
                  {turma.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ed-turno">Turno</Label>
          <Select
            items={TURNOS.map((o) => ({ value: o.value, label: o.label }))}
            value={turnoAtual}
            onValueChange={(valor) => setTurnoAtual(valor ?? "manha")}
          >
            <SelectTrigger id="ed-turno">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TURNOS.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {legal ? (
        <>
          <h4 className="font-extrabold text-sm">Responsável</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-resp">Nome</Label>
              <Input id="ed-resp" value={respNome} onChange={(e) => setRespNome(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-par">Parentesco</Label>
              <Select
                items={PARENTESCOS.map((o) => ({ value: o.value, label: o.label }))}
                value={respParentesco}
                onValueChange={(valor) =>
                  setRespParentesco((valor ?? "responsavel_legal") as typeof respParentesco)
                }
              >
                <SelectTrigger id="ed-par">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARENTESCOS.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-cel">Celular com WhatsApp</Label>
              <Input
                id="ed-cel"
                inputMode="numeric"
                value={celular}
                onChange={(e) => setCelular(mascararCelular(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-email">E-mail</Label>
              <Input
                id="ed-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      {trocouTurma && dados.enrollment.status === "ativa" ? (
        <Alert variant="warning">
          <AlertTitle>Trocar a turma move o aluno de sala</AlertTitle>
          <AlertDescription>
            Ele sai da chamada da turma atual e entra na nova a partir de hoje. Notas e faltas já
            lançadas ficam preservadas.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button
          disabled={enviando || dataInvalida}
          onClick={() =>
            onSalvar({
              student: {
                name: nome !== dados.studentName ? nome : undefined,
                birthDate:
                  nascimentoISO && nascimentoISO !== dados.birthDate ? nascimentoISO : undefined,
              },
              classroomId: trocouTurma ? turmaId : undefined,
              shift:
                turnoAtual !== dados.enrollment.shift
                  ? (turnoAtual as "manha" | "tarde" | "noite")
                  : undefined,
              guardian: legal
                ? {
                    id: legal.id,
                    name: respNome !== legal.name ? respNome : undefined,
                    relationship:
                      respParentesco !== legal.relationship ? respParentesco : undefined,
                    phoneE164: celular !== telefone(legal.phoneE164) ? celular : undefined,
                    email: email !== (legal.email ?? "") ? email || null : undefined,
                  }
                : undefined,
            })
          }
        >
          {enviando ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

/** Rótulo legível de cada campo na trilha. Evita "guardianPhoneE164" na tela. */
const CAMPOS: Record<string, string> = {
  alunoNome: "Nome do aluno",
  nascimento: "Data de nascimento",
  turma: "Turma",
  turno: "Turno",
  responsavelNome: "Nome do responsável",
  parentesco: "Parentesco",
  celular: "Celular",
  email: "E-mail",
  responsavelCelular: "Celular do responsável",
  responsavelEmail: "E-mail do responsável",
};

/**
 * O "de → para" de uma edição, dentro da linha do tempo.
 *
 * É o que transforma um registro de auditoria em algo que a secretaria lê:
 * "Celular: (86) 99812-2039 → (86) 99911-5544", com o valor antigo riscado.
 */
function Alteracoes({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") return null;
  const alteracoes = (payload as { alteracoes?: unknown }).alteracoes;
  if (!alteracoes || typeof alteracoes !== "object") return null;

  const linhas = Object.entries(alteracoes as Record<string, { de?: unknown; para?: unknown }>);
  if (linhas.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-col gap-0.5">
      {linhas.map(([campo, valores]) => (
        <li key={campo} className="text-meta text-muted-foreground leading-relaxed">
          <span className="font-bold">{CAMPOS[campo] ?? campo}:</span>{" "}
          <span className="line-through">{String(valores?.de ?? "—")}</span>{" "}
          <span aria-hidden>→</span>{" "}
          <span className="font-bold text-foreground">{String(valores?.para ?? "—")}</span>
        </li>
      ))}
    </ul>
  );
}
