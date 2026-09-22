import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Skeleton } from "@educa-escola/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, IdCard, Lock, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { dataHora } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

const MOTIVOS = [
  { value: "pedido_do_responsavel", label: "Pedido do responsável" },
  { value: "erro_no_cadastro", label: "Erro no cadastro" },
  { value: "saida_do_aluno", label: "Saída do aluno" },
  { value: "outro", label: "Outro" },
] as const;

type Motivo = (typeof MOTIVOS)[number]["value"];

/**
 * Identificação facial do aluno.
 *
 * Guardamos a foto, cifrada; o molde facial vive no equipamento. Molde é
 * proprietário do algoritmo que o gerou e não é portátil entre fornecedores —
 * a foto é o que permite recadastrar em outra catraca sem trazer nenhuma
 * criança de volta.
 *
 * A foto não é carregada junto com a ficha: quem quiser vê-la clica, e esse
 * clique vira evento na trilha. Foto de criança não fica aberta na tela de
 * quem só passou por ali.
 */
export function IdentificacaoFacial({ studentId }: { studentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"resumo" | "capturando" | "revogando">("resumo");
  const [foto, setFoto] = useState<string | null>(null);

  const status = useQuery(trpc.photo.status.queryOptions({ studentId }));

  const abrir = useMutation(
    trpc.photo.read.mutationOptions({
      onSuccess: (dados) => setFoto(dados.dataUrl),
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const salvar = useMutation(
    trpc.photo.save.mutationOptions({
      onSuccess: () => {
        toast.success("Foto cadastrada.");
        setModo("resumo");
        setFoto(null);
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const revogar = useMutation(
    trpc.photo.revoke.mutationOptions({
      onSuccess: () => {
        toast.success("Identificação facial revogada e foto apagada.");
        setModo("resumo");
        setFoto(null);
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (status.isLoading || !status.data) {
    return (
      <Card className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-28 w-full" />
      </Card>
    );
  }

  const dados = status.data;

  if (modo === "capturando") {
    return (
      <Captura
        enviando={salvar.isPending}
        onCancelar={() => setModo("resumo")}
        onCapturar={(dataUrl) => salvar.mutate({ studentId, dataUrl })}
      />
    );
  }

  if (modo === "revogando") {
    return (
      <Revogacao
        nome={dados.studentName}
        enviando={revogar.isPending}
        onFechar={() => setModo("resumo")}
        onRevogar={(reason) => revogar.mutate({ studentId, reason })}
      />
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardEyebrow>Identificação</CardEyebrow>
          <h2 className="font-extrabold text-base tracking-[-0.2px]">Entrada na escola</h2>
        </div>
        {dados.photo ? (
          <Badge variant="success">Foto cadastrada</Badge>
        ) : dados.authorized ? (
          <Badge variant="warning">Falta capturar</Badge>
        ) : (
          <Badge variant="neutral">Pela carteirinha</Badge>
        )}
      </div>

      {!dados.authorized ? (
        <>
          <Alert>
            <Lock size={18} strokeWidth={1.7} aria-hidden />
            <AlertTitle>
              {dados.consent?.revokedAt
                ? "A autorização foi revogada"
                : dados.consent
                  ? "A família não autorizou a identificação facial"
                  : "Falta a autorização do responsável"}
            </AlertTitle>
            <AlertDescription>
              Dado biométrico de menor exige autorização específica de quem responde por ele. O
              pedido vai no mesmo link de confirmação da matrícula.
            </AlertDescription>
          </Alert>
          <Carteirinha nome={dados.studentName} registration={dados.registration} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid size-40 place-items-center overflow-hidden rounded-card bg-secondary">
              {foto ? (
                <img
                  src={foto}
                  alt={`Foto de ${dados.studentName}`}
                  className="size-full object-cover"
                />
              ) : dados.photo ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <UserRound
                    size={30}
                    strokeWidth={1.4}
                    className="text-muted-foreground"
                    aria-hidden
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={abrir.isPending}
                    onClick={() => abrir.mutate({ studentId })}
                  >
                    {abrir.isPending ? "Abrindo…" : "Ver foto"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UserRound size={34} strokeWidth={1.4} aria-hidden />
                  <span className="text-meta">Sem foto</span>
                </div>
              )}
            </div>

            <dl className="flex min-w-48 flex-1 flex-col gap-2.5">
              <Linha rotulo="Autorizado por">{dados.consent?.actorName ?? "—"}</Linha>
              <Linha rotulo="Termo">{dados.consent?.termVersion ?? "—"}</Linha>
              <Linha rotulo="Autorizado em">{dataHora(dados.consent?.grantedAt)}</Linha>
              {dados.photo ? (
                <>
                  <Linha rotulo="Capturada em">{dataHora(dados.photo.capturedAt)}</Linha>
                  <Linha rotulo="Na catraca">
                    {dados.photo.syncedAt ? "sincronizada" : "aguardando envio"}
                  </Linha>
                </>
              ) : null}
            </dl>
          </div>

          <p className="text-meta text-muted-foreground">
            A foto fica cifrada no banco e não aparece em listagem, nem para a direção. Cada
            abertura fica registrada na linha do tempo. O molde facial vive no equipamento, não
            conosco.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModo("capturando")}>
              <Camera size={18} strokeWidth={1.7} aria-hidden />
              {dados.photo ? "Recapturar" : "Capturar foto"}
            </Button>
            {dados.photo || dados.consent ? (
              <Button variant="warning" onClick={() => setModo("revogando")}>
                <Trash2 size={18} strokeWidth={1.7} aria-hidden />
                Revogar
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Card>
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

/**
 * A carteirinha existe para todo aluno, tenha ou não foto.
 *
 * Recusar a face não pode barrar criança na porta da escola — é isso que faz o
 * consentimento ser de verdade opcional, e não uma formalidade.
 */
function Carteirinha({ nome, registration }: { nome: string; registration: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card bg-muted p-4">
      <div className="grid size-24 place-items-center rounded-field bg-card">
        <IdCard size={38} strokeWidth={1.3} aria-hidden />
      </div>
      <div className="flex-1">
        <p className="font-bold text-corpo">{nome} entra pela carteirinha</p>
        <p className="mt-1 text-meta text-muted-foreground">
          A catraca lê o QR, que carrega o número de matrícula.
        </p>
        <p className="mt-2 font-extrabold text-base tabular-nums">{registration}</p>
      </div>
      <Button variant="secondary" size="sm">
        Imprimir carteirinha
      </Button>
    </div>
  );
}

/** Captura pela câmera do tablet, com recorte quadrado. */
function Captura({
  enviando,
  onCancelar,
  onCapturar,
}: {
  enviando: boolean;
  onCancelar: () => void;
  onCapturar: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);

  useEffect(() => {
    if (previa) return;
    let stream: MediaStream | undefined;

    // `getUserMedia` só existe em origem segura: localhost passa, mas o tablet
    // acessando pela rede da escola exige HTTPS. O erro abaixo é o que a
    // secretaria vai ler quando isso acontecer.
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 720, height: 720 } })
      .then((obtido) => {
        stream = obtido;
        if (videoRef.current) videoRef.current.srcObject = obtido;
      })
      .catch(() => setErro("Não foi possível acessar a câmera."));

    return () => {
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [previa]);

  function capturar() {
    const video = videoRef.current;
    if (!video) return;

    // Recorte quadrado no centro: a catraca compara rosto, não cenário.
    const lado = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;

    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.drawImage(
      video,
      (video.videoWidth - lado) / 2,
      (video.videoHeight - lado) / 2,
      lado,
      lado,
      0,
      0,
      lado,
      lado,
    );

    setPrevia(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardEyebrow>Identificação</CardEyebrow>
        <h2 className="font-extrabold text-base tracking-[-0.2px]">
          {previa ? "Confira a foto" : "Capturar rosto"}
        </h2>
        <p className="mt-1 text-corpo text-muted-foreground">
          Pela câmera do tablet. Peça que o aluno olhe para a câmera, sem boné e sem óculos escuros.
        </p>
      </div>

      {erro ? (
        <div className="flex flex-col items-center gap-3 rounded-card bg-warning-soft p-6 text-center">
          <CameraOff size={26} strokeWidth={1.7} className="text-warning" aria-hidden />
          <p className="font-bold text-corpo">{erro}</p>
          <p className="max-w-sm text-apoio text-muted-foreground">
            Autorize o uso da câmera no navegador. Em rede, a página precisa estar em HTTPS — a
            câmera não abre em conexão comum.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid size-64 place-items-center overflow-hidden rounded-card bg-secondary">
          {previa ? (
            <img src={previa} alt="Prévia da captura" className="size-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover"
              aria-label="Imagem da câmera"
            >
              <track kind="captions" />
            </video>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={previa ? () => setPrevia(null) : onCancelar}>
          {previa ? "Capturar de novo" : "Voltar"}
        </Button>
        {previa ? (
          <Button disabled={enviando} onClick={() => onCapturar(previa)}>
            {enviando ? "Salvando…" : "Usar esta foto"}
          </Button>
        ) : (
          <Button disabled={Boolean(erro)} onClick={capturar}>
            <Camera size={18} strokeWidth={1.7} aria-hidden />
            Capturar
          </Button>
        )}
      </div>
    </Card>
  );
}

function Revogacao({
  nome,
  enviando,
  onFechar,
  onRevogar,
}: {
  nome: string;
  enviando: boolean;
  onFechar: () => void;
  onRevogar: (motivo: Motivo) => void;
}) {
  const [motivo, setMotivo] = useState<Motivo>("pedido_do_responsavel");

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardEyebrow>Identificação</CardEyebrow>
        <h2 className="font-extrabold text-base tracking-[-0.2px]">Revogar de {nome}</h2>
      </div>

      <div className="flex flex-col gap-2 rounded-card bg-danger-soft p-4">
        <p className="text-apoio leading-relaxed">
          Isto <b>apaga a foto</b> do nosso banco e manda o equipamento remover o molde dele. Não é
          reversível — recadastrar exige nova captura e nova autorização.
        </p>
        <p className="text-apoio leading-relaxed">
          O registro de que houve consentimento, e de que ele foi revogado, permanece: é o que prova
          que a escola agiu certo. A frequência já registrada também fica.
        </p>
      </div>

      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="motivo-revogacao">Motivo</Label>
        <Select
          items={MOTIVOS.map((o) => ({ value: o.value, label: o.label }))}
          value={motivo}
          onValueChange={(valor) => setMotivo((valor ?? "outro") as Motivo)}
        >
          <SelectTrigger id="motivo-revogacao">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOTIVOS.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
        <Button variant="destructive" disabled={enviando} onClick={() => onRevogar(motivo)}>
          {enviando ? "Revogando…" : "Revogar e apagar"}
        </Button>
      </div>
    </Card>
  );
}
