import { identificar } from "@educa-escola/api/modules/gate/reconhecimento";
import { Button } from "@educa-escola/ui/components/button";
import { Input } from "@educa-escola/ui/components/input";
import { SegmentedControl } from "@educa-escola/ui/integra/segmented";
import { cn } from "@educa-escola/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraOff, Check, IdCard, ScanEye, TriangleAlert, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { extratorDeRosto, rostoDisponivel } from "@/lib/extrator-de-rosto";
import { useTRPC } from "@/utils/trpc";

/** O cartão que a tela mostra. Só identidade — nunca nota nem frequência. */
interface Cartao {
  studentId: string;
  name: string;
  registration: string;
  classroomName: string | null;
  shift: string;
}

type Estado =
  | { tipo: "aguardando" }
  | {
      tipo: "liberado";
      cartao: Cartao;
      hora: Date;
      metodo: "rosto" | "carteirinha";
      direction: "entrada" | "saida";
    }
  | { tipo: "recusado"; titulo: string; detalhe: string };

/** Quanto tempo o resultado fica na tela antes de voltar ao repouso. */
const TEMPO_DO_CARTAO_MS = 4000;

/**
 * Intervalo entre leituras da câmera.
 *
 * A extração custa dezenas de milissegundos e segura a thread da tela. Ler a
 * cada quadro deixaria o vídeo travado — e vídeo travado numa portaria parece
 * defeito, mesmo quando o reconhecimento está funcionando.
 */
const INTERVALO_DA_LEITURA_MS = 350;

const hora = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");

/**
 * A portaria, em modo quiosque.
 *
 * O fluxo é o de catraca de academia: **ninguém toca em nada**. A câmera fica
 * ligada, o rosto é lido ao se aproximar, o cartão aparece por quatro segundos
 * e a tela volta ao repouso sozinha.
 *
 * Duas regras que a tela cumpre e não negocia:
 *
 * - **A carteirinha é o modo que nunca falha.** Rosto não reconhecido, lote
 *   vencido, câmera negada, biblioteca ausente — todo caminho que dá errado
 *   termina pedindo o QR, nunca barrando a criança na porta.
 * - **A recusa não expõe ninguém.** "Não identificado" cobre rosto
 *   desconhecido e rosto ambíguo, e nunca diz "sua família não autorizou" na
 *   frente da fila.
 */
export function PortariaQuiosque({ deviceLabel }: { deviceLabel: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>({ tipo: "aguardando" });
  const [erroDaCamera, setErroDaCamera] = useState<string | null>(null);
  const [matricula, setMatricula] = useState("");
  /**
   * Entrada ou saída, escolhido por quem abre o quiosque.
   *
   * Não é inferido da última passagem do aluno: uma releitura minutos depois
   * da chegada viraria "saiu da escola", e aí a lista de quem está dentro
   * passa a mentir justamente no dia em que alguém precisar dela. Portão de
   * escola tem turno — entrada na chegada, saída na dispensa —, e quem sabe
   * disso é a pessoa no portão.
   */
  const [direcao, setDirecao] = useState<"entrada" | "saida">("entrada");
  const [agora, setAgora] = useState(() => new Date());
  /**
   * Quanto custou a última leitura, em milissegundos.
   *
   * Fica na tela porque "está rápido?" não se responde por palpite: o custo é
   * da extração e depende do tablet, não do nosso código. Com o número à
   * vista, a escola compara aparelhos antes de comprar — e se estiver ruim, o
   * caminho é reduzir a resolução do quadro, não trocar a arquitetura.
   */
  const [msDaLeitura, setMsDaLeitura] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const situacao = useQuery({ ...trpc.gate.situacao.queryOptions(), refetchInterval: 30_000 });

  /**
   * O lote de moldes.
   *
   * `refetchInterval` é o que faz uma revogação chegar ao portão: o servidor
   * devolve `validoAte`, e a tela busca de novo antes de vencer. Nada disso é
   * gravado em disco — recarregar a página busca tudo outra vez, e o tablet
   * não fica com biometria de criança em repouso.
   */
  const lote = useQuery({
    ...trpc.gate.lote.queryOptions(),
    refetchInterval: 5 * 60_000,
    enabled: rostoDisponivel(),
  });

  const registrar = useMutation(
    trpc.gate.registrar.mutationOptions({
      onSuccess: (saida) => {
        setEstado({
          tipo: "liberado",
          cartao: { ...saida.aluno, classroomName: saida.aluno.classroomName ?? null },
          hora: new Date(saida.occurredAt),
          metodo: saida.method === "rosto" ? "rosto" : "carteirinha",
          direction: saida.direction,
        });
        // O contador do rodapé acabou de mudar. Esperar o próximo intervalo
        // deixaria a portaria mostrando "0 na escola" logo depois de liberar
        // alguém — e quem está no portão lê isso como defeito.
        queryClient.invalidateQueries({ queryKey: trpc.gate.situacao.queryKey() });
      },
      onError: (erro) =>
        setEstado({ tipo: "recusado", titulo: "Procure a secretaria", detalhe: erro.message }),
    }),
  );

  const porMatricula = useMutation(
    trpc.gate.porMatricula.mutationOptions({
      onSuccess: (saida) => {
        if (!saida.encontrado) {
          setEstado({
            tipo: "recusado",
            titulo: "Carteirinha não reconhecida",
            detalhe: "Confira o número ou chame a secretaria.",
          });
          return;
        }
        registrar.mutate({
          studentId: saida.aluno.studentId,
          direction: direcao,
          method: "carteirinha",
          deviceLabel,
        });
      },
    }),
  );

  /** O relógio do rodapé. A portaria fica horas na mesma tela. */
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);

  /** Volta ao repouso sozinha: ninguém aperta "ok" numa catraca. */
  useEffect(() => {
    if (estado.tipo === "aguardando") return;
    const t = setTimeout(() => setEstado({ tipo: "aguardando" }), TEMPO_DO_CARTAO_MS);
    return () => clearTimeout(t);
  }, [estado]);

  /*
   * Carrega o modelo na abertura, não na primeira pessoa que chegar.
   *
   * São megabytes: pagar isso quando alguém já está na frente da câmera
   * pareceria a portaria travada justo na hora de usar.
   */
  useEffect(() => {
    if (rostoDisponivel()) void extratorDeRosto.preparar();
  }, []);

  useEffect(() => {
    let stream: MediaStream | undefined;

    // `getUserMedia` só existe em origem segura. `localhost` passa — é assim
    // que se testa —, mas o tablet acessando por IP na rede da escola exige
    // HTTPS. O aviso abaixo é o que a recepção vai ler quando isso acontecer.
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 720, height: 720 } })
      .then((obtido) => {
        stream = obtido;
        if (videoRef.current) videoRef.current.srcObject = obtido;
      })
      .catch(() => setErroDaCamera("Não foi possível acessar a câmera."));

    return () => {
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);

  const moldes = lote.data?.alunos ?? [];
  const loteVencido = lote.data ? new Date(lote.data.validoAte) < agora : false;
  const rostoLigado = rostoDisponivel() && !erroDaCamera && moldes.length > 0 && !loteVencido;

  /**
   * O laço de leitura.
   *
   * Roda enquanto a tela está em repouso e para assim que alguém é
   * reconhecido: continuar lendo enquanto o cartão está na tela releria a
   * mesma pessoa, que o servidor já descartaria por repetição — e gastaria
   * processador do tablet à toa.
   *
   * A comparação usa `identificar`, a **mesma** função do servidor. Duas
   * implementações do mesmo limiar divergiriam, e a divergência apareceria
   * como "no tablet abre, no servidor não".
   */
  useEffect(() => {
    if (!rostoLigado || estado.tipo !== "aguardando" || registrar.isPending) return;

    let vivo = true;
    let emLeitura = false;

    const ler = async () => {
      if (!vivo || emLeitura || !videoRef.current) return;
      emLeitura = true;
      try {
        const comecou = performance.now();
        const descritor = await extratorDeRosto.extrair(videoRef.current);
        if (!vivo) return;
        setMsDaLeitura(Math.round(performance.now() - comecou));
        if (!descritor) return;

        const veredito = identificar(descritor, moldes);
        if (veredito.tipo !== "reconhecido") return;

        registrar.mutate({
          studentId: veredito.studentId,
          direction: direcao,
          method: "rosto",
          deviceLabel,
        });
      } finally {
        emLeitura = false;
      }
    };

    const t = setInterval(ler, INTERVALO_DA_LEITURA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [rostoLigado, estado.tipo, registrar, moldes, direcao, deviceLabel]);

  return (
    <div className="flex min-h-svh flex-col gap-4 bg-kiosk p-4 sm:p-6">
      <Palco
        estado={estado}
        videoRef={videoRef}
        erroDaCamera={erroDaCamera}
        rostoLigado={rostoLigado}
      />

      <SegmentedControl
        label="O portão está registrando"
        value={direcao}
        onChange={setDirecao}
        options={[
          { value: "entrada", label: "Entrada", tone: "success" },
          { value: "saida", label: "Saída", tone: "warning" },
        ]}
      />

      {/*
        A carteirinha fica sempre visível, e não escondida atrás de um botão
        "não me reconheceu": quem precisa dela é justamente quem a tela acabou
        de não reconhecer, e caçar botão na frente da fila é o que trava o
        portão.
      */}
      <form
        className="flex flex-wrap items-center gap-3 rounded-card bg-kiosk-soft p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const valor = matricula.trim();
          if (!valor) return;
          porMatricula.mutate({ registration: valor });
          setMatricula("");
        }}
      >
        <IdCard size={26} strokeWidth={1.6} className="text-kiosk-foreground/60" aria-hidden />
        <Input
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          placeholder="Número da carteirinha"
          aria-label="Número da carteirinha"
          className="min-w-40 flex-1 bg-kiosk text-card text-kiosk-foreground"
        />
        <Button type="submit" disabled={porMatricula.isPending || registrar.isPending}>
          Liberar
        </Button>
      </form>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-kiosk-soft px-5 py-3 text-kiosk-foreground/70">
        <span className="flex items-center gap-2 text-card">
          <Users size={19} strokeWidth={1.7} aria-hidden />
          {situacao.data?.dentro ?? 0} na escola agora
        </span>
        <span className="text-card tabular-nums">{hora(agora)}</span>
        {/* Só aparece quando o rosto está ligado: número solto no rodapé de
            uma portaria que só usa carteirinha seria ruído. */}
        {rostoLigado && msDaLeitura !== null ? (
          <span className="text-apoio tabular-nums">leitura em {msDaLeitura} ms</span>
        ) : null}
        <span className="text-apoio">{deviceLabel}</span>
      </footer>
    </div>
  );
}

/** O centro da tela: câmera em repouso, cartão do aluno, ou a recusa. */
function Palco({
  estado,
  videoRef,
  erroDaCamera,
  rostoLigado,
}: {
  estado: Estado;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  erroDaCamera: string | null;
  rostoLigado: boolean;
}) {
  const borda =
    estado.tipo === "liberado"
      ? "border-success"
      : estado.tipo === "recusado"
        ? "border-warning"
        : "border-transparent";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-6 rounded-card border-4 bg-kiosk-soft p-6 text-center sm:flex-row sm:text-left",
        borda,
      )}
    >
      <div className="grid size-48 shrink-0 place-items-center overflow-hidden rounded-card bg-kiosk sm:size-56">
        {estado.tipo === "liberado" ? (
          // A foto cadastrada **não** aparece aqui: a tela fica ligada num
          // corredor por onde passa qualquer um, e o nome já identifica quem
          // a catraca liberou. Conferência com foto é tela da secretaria.
          <UserRound size={78} strokeWidth={1.2} className="text-kiosk-foreground/70" aria-hidden />
        ) : erroDaCamera ? (
          <CameraOff size={54} strokeWidth={1.6} className="text-warning" aria-hidden />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Imagem da câmera"
            className="size-full object-cover"
          >
            <track kind="captions" />
          </video>
        )}
      </div>

      <div className="min-w-0">
        {estado.tipo === "liberado" ? (
          <>
            <p className="font-bold text-card text-success uppercase tracking-[0.7px]">
              {estado.direction === "saida" ? "Saída registrada" : "Entrada liberada"}
            </p>
            <p className="mt-1 break-words font-extrabold text-3xl text-kiosk-foreground">
              {estado.cartao.name}
            </p>
            <p className="mt-1 text-card text-kiosk-foreground/70">
              {[estado.cartao.classroomName, estado.cartao.shift, estado.cartao.registration]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-card text-success sm:justify-start">
              <Check size={20} strokeWidth={2.2} aria-hidden />
              Registrado às {hora(estado.hora)} · {estado.metodo}
            </p>
          </>
        ) : estado.tipo === "recusado" ? (
          <>
            <p className="font-bold text-card text-warning uppercase tracking-[0.7px]">
              <TriangleAlert
                size={18}
                strokeWidth={2}
                aria-hidden
                className="mr-2 inline align-[-3px]"
              />
              {estado.titulo}
            </p>
            <p className="mt-2 text-2xl text-kiosk-foreground">{estado.detalhe}</p>
          </>
        ) : (
          <>
            <p className="font-extrabold text-3xl text-kiosk-foreground">
              {rostoLigado ? "Aproxime o rosto" : "Encoste a carteirinha"}
            </p>
            <p className="mt-2 text-card text-kiosk-foreground/70">
              {erroDaCamera
                ? "A câmera não abriu. Em rede, o tablet precisa estar em HTTPS — a carteirinha continua funcionando."
                : rostoLigado
                  ? "ou encoste a carteirinha no leitor"
                  : "o reconhecimento por rosto está indisponível agora"}
            </p>
            {rostoLigado ? (
              <p className="mt-3 flex items-center justify-center gap-2 text-apoio text-kiosk-foreground/50 sm:justify-start">
                <ScanEye size={17} strokeWidth={1.7} aria-hidden />
                {extratorDeRosto.nome}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
