import { identificar } from "@educa-escola/api/modules/gate/reconhecimento";
import { cn } from "@educa-escola/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraOff, Check, ScanFace, TriangleAlert, UserRound, Users } from "lucide-react";
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

/**
 * Os quatro estados do portão.
 *
 * `hibernando` é o estado normal: uma portaria passa quase o dia inteiro sem
 * ninguém na frente. `lendo` só existe enquanto há rosto no quadro.
 */
type Estado =
  | { tipo: "hibernando" }
  | { tipo: "lendo" }
  | {
      tipo: "liberado";
      cartao: Cartao;
      hora: Date;
      metodo: "rosto" | "carteirinha";
      direction: "entrada" | "saida";
    }
  | { tipo: "recusado"; titulo: string; detalhe: string };

/** Quanto tempo o resultado fica na tela antes de voltar a hibernar. */
const TEMPO_DO_CARTAO_MS = 4000;

/**
 * Intervalo do sensor de presença.
 *
 * Meio segundo é imperceptível para quem chega andando e deixa o tablet
 * quieto o resto do tempo. O sensor roda só o detector, que custa uma fração
 * da extração.
 */
const INTERVALO_DO_SENSOR_MS = 500;

/**
 * Intervalo da leitura, com rosto já na frente.
 *
 * A extração segura a thread da tela por dezenas de milissegundos. Ler a cada
 * quadro deixaria o vídeo travado — e vídeo travado numa portaria parece
 * defeito, mesmo com o reconhecimento funcionando.
 */
const INTERVALO_DA_LEITURA_MS = 300;

/**
 * Quanto tempo insistir antes de desistir do rosto.
 *
 * Sem isso, quem não é reconhecido fica olhando a câmera para sempre. Seis
 * segundos é o bastante para alguém se posicionar, e curto o bastante para a
 * fila não parar.
 */
const PACIENCIA_MS = 6000;

const hora = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");

/**
 * A portaria, em modo quiosque.
 *
 * **Ninguém toca em nada, e não há botão nenhum.** A tela hiberna com
 * "Aproxime o rosto"; o sensor vê alguém e abre a câmera; o rosto é lido, o
 * cartão aparece por quatro segundos e ela volta a hibernar.
 *
 * O sentido da passagem é do portão, não de um botão: `sentido` vem da URL,
 * para a câmera da entrada e a da saída serem dois quiosques. Sem ele, o
 * servidor alterna a partir da última passagem do dia.
 *
 * A carteirinha continua sendo a rede de segurança, e também sem ninguém
 * digitar: o campo é invisível e mantém o foco, porque leitor de QR se
 * comporta como teclado. Quem precisa dele é justamente quem a câmera não
 * reconheceu.
 */
export function PortariaQuiosque({
  deviceLabel,
  sentido,
}: {
  deviceLabel: string;
  sentido?: "entrada" | "saida";
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>({ tipo: "hibernando" });
  const [erroDaCamera, setErroDaCamera] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [msDaLeitura, setMsDaLeitura] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const leitorRef = useRef<HTMLInputElement>(null);
  /** Quando o rosto apareceu. Alimenta a paciência antes de desistir. */
  const desdeRef = useRef<number>(0);

  const situacao = useQuery({ ...trpc.gate.situacao.queryOptions(), refetchInterval: 30_000 });

  /**
   * O lote de moldes.
   *
   * Nada disso é gravado em disco — recarregar a página busca outra vez, e o
   * tablet não fica com biometria de criança em repouso. O prazo do lote é o
   * que faz uma revogação chegar ao portão.
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
            detalhe: "Chame a secretaria.",
          });
          return;
        }
        registrar.mutate({
          studentId: saida.aluno.studentId,
          direction: sentido,
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

  /*
   * Carrega o modelo na abertura, não na primeira pessoa que chegar. São
   * megabytes: pagar isso com alguém já na frente da câmera pareceria a
   * portaria travada justo na hora de usar.
   */
  useEffect(() => {
    if (rostoDisponivel()) void extratorDeRosto.preparar();
  }, []);

  /** Volta a hibernar sozinha: ninguém aperta "ok" numa catraca. */
  useEffect(() => {
    if (estado.tipo !== "liberado" && estado.tipo !== "recusado") return;
    const t = setTimeout(() => setEstado({ tipo: "hibernando" }), TEMPO_DO_CARTAO_MS);
    return () => clearTimeout(t);
  }, [estado]);

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

  /**
   * O foco vive no campo invisível da carteirinha.
   *
   * Leitor de QR é um teclado: ele "digita" o número e aperta Enter. Sem foco
   * garantido, a leitura se perde — e ninguém na portaria vai clicar num campo
   * antes de passar o crachá.
   */
  useEffect(() => {
    const focar = () => leitorRef.current?.focus();
    focar();
    const t = setInterval(focar, 2000);
    document.addEventListener("click", focar);
    return () => {
      clearInterval(t);
      document.removeEventListener("click", focar);
    };
  }, []);

  const moldes = lote.data?.alunos ?? [];
  const loteVencido = lote.data ? new Date(lote.data.validoAte) < agora : false;
  const rostoLigado = rostoDisponivel() && !erroDaCamera && moldes.length > 0 && !loteVencido;

  /**
   * O sensor de presença, que é o que acorda a portaria.
   *
   * Roda só enquanto a tela hiberna, e só o detector — não os pontos do rosto
   * nem a rede do descritor. Numa portaria vazia, que é o estado quase o dia
   * inteiro, é a diferença entre o tablet esquentando à toa e esperando
   * quieto.
   */
  useEffect(() => {
    if (!rostoLigado || estado.tipo !== "hibernando") return;

    let vivo = true;
    let ocupado = false;

    const olhar = async () => {
      if (!vivo || ocupado || !videoRef.current) return;
      ocupado = true;
      try {
        if (await extratorDeRosto.temRosto(videoRef.current)) {
          if (!vivo) return;
          desdeRef.current = performance.now();
          setEstado({ tipo: "lendo" });
        }
      } finally {
        ocupado = false;
      }
    };

    const t = setInterval(olhar, INTERVALO_DO_SENSOR_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [rostoLigado, estado.tipo]);

  /**
   * A leitura, com alguém já na frente da câmera.
   *
   * A comparação usa `identificar`, a **mesma** função do servidor. Duas
   * implementações do mesmo limiar divergiriam, e a divergência apareceria
   * como "no tablet abre, no servidor não".
   */
  useEffect(() => {
    if (estado.tipo !== "lendo" || registrar.isPending) return;

    let vivo = true;
    let ocupado = false;

    const ler = async () => {
      if (!vivo || ocupado || !videoRef.current) return;
      ocupado = true;
      try {
        const comecou = performance.now();
        const descritor = await extratorDeRosto.extrair(videoRef.current);
        if (!vivo) return;
        setMsDaLeitura(Math.round(performance.now() - comecou));

        if (descritor) {
          const veredito = identificar(descritor, moldes);
          if (veredito.tipo === "reconhecido") {
            registrar.mutate({
              studentId: veredito.studentId,
              direction: sentido,
              method: "rosto",
              deviceLabel,
            });
            return;
          }
        }

        // Desistiu: ou ninguém foi reconhecido, ou a pessoa saiu da frente.
        // A carteirinha resolve, e insistir para sempre pararia a fila.
        if (performance.now() - desdeRef.current > PACIENCIA_MS) {
          setEstado(
            descritor
              ? {
                  tipo: "recusado",
                  titulo: "Não identificado",
                  detalhe: "Passe a carteirinha no leitor.",
                }
              : { tipo: "hibernando" },
          );
        }
      } finally {
        ocupado = false;
      }
    };

    const t = setInterval(ler, INTERVALO_DA_LEITURA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [estado.tipo, registrar, moldes, sentido, deviceLabel]);

  const acordada = estado.tipo !== "hibernando";

  return (
    <div className="flex min-h-svh flex-col gap-4 bg-kiosk p-4 sm:p-6">
      {/*
        Invisível e sempre em foco: leitor de QR se comporta como teclado, e
        ninguém na portaria vai clicar num campo antes de passar o crachá.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const campo = leitorRef.current;
          const valor = campo?.value.trim();
          if (campo) campo.value = "";
          if (valor) porMatricula.mutate({ registration: valor });
        }}
      >
        <input
          ref={leitorRef}
          className="sr-only"
          aria-label="Leitor de carteirinha"
          autoComplete="off"
        />
      </form>

      <Palco
        estado={estado}
        videoRef={videoRef}
        erroDaCamera={erroDaCamera}
        rostoLigado={rostoLigado}
        acordada={acordada}
      />

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
        <span className="text-apoio">
          {deviceLabel}
          {sentido ? ` · ${sentido === "saida" ? "saída" : "entrada"}` : null}
        </span>
      </footer>
    </div>
  );
}

/** O centro da tela: hibernação, câmera aberta, cartão do aluno ou recusa. */
function Palco({
  estado,
  videoRef,
  erroDaCamera,
  rostoLigado,
  acordada,
}: {
  estado: Estado;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  erroDaCamera: string | null;
  rostoLigado: boolean;
  acordada: boolean;
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
        "flex flex-1 flex-col items-center justify-center gap-6 rounded-card border-4 bg-kiosk-soft p-6 text-center",
        borda,
      )}
    >
      {/*
        O vídeo fica montado o tempo todo, mesmo hibernando: é dele que o
        sensor lê. Desmontar exigiria reabrir a câmera a cada pessoa, e o
        navegador leva quase um segundo nisso — tempo que a fila sente.
      */}
      <div
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-card bg-kiosk transition-all",
          acordada ? "size-64 sm:size-80" : "size-0 opacity-0",
        )}
      >
        {estado.tipo === "liberado" ? (
          // A foto cadastrada **não** aparece aqui: a tela fica num corredor
          // por onde passa qualquer um, e o nome já identifica quem passou.
          <UserRound size={92} strokeWidth={1.2} className="text-kiosk-foreground/70" aria-hidden />
        ) : null}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Imagem da câmera"
          className={cn("size-full object-cover", estado.tipo === "liberado" && "hidden")}
        >
          <track kind="captions" />
        </video>
      </div>

      {estado.tipo === "liberado" ? (
        <div>
          <p className="font-bold text-card text-success uppercase tracking-[0.7px]">
            {estado.direction === "saida" ? "Saída registrada" : "Entrada liberada"}
          </p>
          <p className="mt-1 break-words font-extrabold text-4xl text-kiosk-foreground">
            {estado.cartao.name}
          </p>
          <p className="mt-2 text-card text-kiosk-foreground/70">
            {[estado.cartao.classroomName, estado.cartao.shift, estado.cartao.registration]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 flex items-center justify-center gap-2 text-card text-success">
            <Check size={20} strokeWidth={2.2} aria-hidden />
            {hora(estado.hora)} · {estado.metodo}
          </p>
        </div>
      ) : estado.tipo === "recusado" ? (
        <div>
          <p className="font-bold text-card text-warning uppercase tracking-[0.7px]">
            <TriangleAlert
              size={18}
              strokeWidth={2}
              aria-hidden
              className="mr-2 inline align-[-3px]"
            />
            {estado.titulo}
          </p>
          <p className="mt-2 text-3xl text-kiosk-foreground">{estado.detalhe}</p>
        </div>
      ) : estado.tipo === "lendo" ? (
        <p className="text-card text-kiosk-foreground/70">Lendo…</p>
      ) : (
        <div className="flex flex-col items-center gap-5">
          {erroDaCamera ? (
            <CameraOff size={58} strokeWidth={1.5} className="text-warning" aria-hidden />
          ) : (
            <ScanFace
              size={72}
              strokeWidth={1.2}
              className="text-kiosk-foreground/40"
              aria-hidden
            />
          )}
          <p className="font-extrabold text-4xl text-kiosk-foreground sm:text-5xl">
            {rostoLigado ? "Aproxime o rosto da tela" : "Passe a carteirinha no leitor"}
          </p>
          {erroDaCamera ? (
            <p className="max-w-lg text-card text-kiosk-foreground/60">
              A câmera não abriu. Em rede, o tablet precisa estar em HTTPS — a carteirinha continua
              funcionando.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
