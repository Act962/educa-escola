import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Checkbox } from "@educa-escola/ui/components/checkbox";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Skeleton } from "@educa-escola/ui/components/skeleton";
import { OrbitaBrand } from "@educa-escola/ui/integra/orbita";
import { Passos } from "@educa-escola/ui/integra/steps";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, Lock, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { dateTimeText, phoneText } from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/matricula/$token")({
  component: ConfirmacaoMatricula,
  head: () => ({
    meta: [
      // O token está na URL: sem isto ele viaja no cabeçalho Referer para
      // qualquer recurso externo, e entra em índice de busca.
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const PARENTESCOS = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avó ou avô" },
  { value: "responsavel_legal", label: "Responsável legal" },
  { value: "outro", label: "Outro" },
] as const;

type Parentesco = (typeof PARENTESCOS)[number]["value"];

interface Ficha {
  schoolName: string;
  academicYear: number;
  termVersion: string;
  student: { name: string; shift: string };
  guardian: { name: string; relationship: string; phoneE164: string; email: string | null } | null;
}

/**
 * Confirmação de matrícula pelo responsável.
 *
 * Fora de `_app/` de propósito: não há sessão, não há menu e não há barra de
 * contexto. Quem abre é a família, pelo celular, a partir de um link — e a
 * única coisa que ela pode fazer aqui é conferir a própria ficha.
 */
function ConfirmacaoMatricula() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [protocolo, setProtocolo] = useState<{ protocol: string; submittedAt: Date } | null>(null);

  const abertura = useQuery({
    ...trpc.enrollmentLink.open.queryOptions({ token }),
    retry: false,
  });

  if (abertura.isLoading) {
    return (
      <Casca>
        <Card className="flex w-full max-w-md flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      </Casca>
    );
  }

  if (abertura.error) {
    return <Recusa codigo={abertura.error.data?.code} mensagem={abertura.error.message} />;
  }

  if (protocolo) {
    return (
      <Comprovante
        protocolo={protocolo.protocol}
        quando={protocolo.submittedAt}
        escola={abertura.data?.schoolName ?? ""}
      />
    );
  }

  if (abertura.data?.state === "consumido") {
    return (
      <Casca escola={abertura.data.schoolName}>
        <Card className="flex w-full max-w-md flex-col gap-4">
          <Estado
            tom="info"
            icone={<Check size={22} strokeWidth={1.8} aria-hidden />}
            titulo="Você já enviou esta ficha"
            descricao={`Recebemos os dados em ${dateTimeText(abertura.data.submittedAt)}. A secretaria está conferindo.`}
          />
          <div className="rounded-card bg-muted p-4 text-center">
            <CardEyebrow>Protocolo</CardEyebrow>
            <p className="mt-1 font-extrabold text-base tabular-nums tracking-[0.5px]">
              {abertura.data.protocol}
            </p>
          </div>
        </Card>
      </Casca>
    );
  }

  if (!ficha) {
    return (
      <Conferencia
        token={token}
        escola={abertura.data?.schoolName ?? ""}
        ano={abertura.data?.academicYear ?? 0}
        onConferido={setFicha}
      />
    );
  }

  /*
   * O link curto pergunta uma coisa só.
   *
   * A finalidade vem do convite, não de uma rota diferente: é o mesmo token,
   * a mesma conferência de data de nascimento e a mesma máquina de prazo e
   * revogação. Só o que se pergunta depois muda — e reabrir a ficha inteira
   * para marcar uma caixa faria a família reconfirmar telefone e endereço,
   * que é uma chance a mais de sobrescrever dado certo por dado velho.
   */
  if (abertura.data?.finalidade === "biometria") {
    return <AutorizacaoDeBiometria token={token} ficha={ficha} escola={abertura.data.schoolName} />;
  }

  return <Formulario token={token} ficha={ficha} onEnviado={setProtocolo} />;
}

/**
 * A pergunta única: a família autoriza a identificação facial?
 *
 * Recusar é resposta legítima e está na mesma altura do aceitar. Quem recusa
 * entra pela carteirinha, e a tela diz isso — família que teme ser punida por
 * dizer não acaba dizendo sim, e aí o consentimento deixa de ser livre.
 */
function AutorizacaoDeBiometria({
  token,
  ficha,
  escola,
}: {
  token: string;
  ficha: Ficha;
  escola: string;
}) {
  const trpc = useTRPC();
  const [nome, setNome] = useState(ficha.guardian?.name ?? "");
  const [respondido, setRespondido] = useState<boolean | null>(null);

  const responder = useMutation(
    trpc.enrollmentLink.autorizarBiometria.mutationOptions({
      onSuccess: (saida) => setRespondido(saida.autorizou),
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (respondido !== null) {
    return (
      <Casca escola={escola}>
        <Card className="flex w-full max-w-md flex-col gap-4">
          <Estado
            tom={respondido ? "success" : "info"}
            icone={<Check size={22} strokeWidth={1.8} aria-hidden />}
            titulo={respondido ? "Autorização registrada" : "Resposta registrada"}
            descricao={
              respondido
                ? `${ficha.student.name} vai poder entrar pelo reconhecimento facial. Você pode retirar esta autorização a qualquer momento, falando com a escola.`
                : `${ficha.student.name} vai entrar pela carteirinha, normalmente. Nada muda no dia a dia.`
            }
          />
        </Card>
      </Casca>
    );
  }

  return (
    <Casca escola={escola}>
      <Card className="flex w-full max-w-md flex-col gap-5">
        <div>
          <CardEyebrow>Autorização</CardEyebrow>
          <h1 className="font-extrabold text-xl tracking-[-0.4px]">
            Identificação facial na entrada
          </h1>
          <p className="mt-2 text-corpo text-muted-foreground">
            A escola quer usar o reconhecimento do rosto de {ficha.student.name} para registrar a
            entrada e a saída. É opcional.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-card bg-muted p-4 text-apoio leading-relaxed">
          <p>
            <b>Se você autorizar:</b> a escola guarda a foto e os códigos do rosto, cifrados. Eles
            servem só para a portaria, e somem se você retirar a autorização.
          </p>
          <p>
            {/* Sem pronome: o nome do aluno não diz o gênero dele, e errar
                isso na cara da família é o tipo de descuido que custa
                confiança. */}
            <b>Se você não autorizar:</b> {ficha.student.name} entra pela carteirinha, com o QR do
            número de matrícula. Não muda nada no dia a dia.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quem-responde">Seu nome</Label>
          <Input
            id="quem-responde"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Quem está respondendo"
          />
        </div>

        {/*
          Os dois botões têm o mesmo peso visual de propósito. "Não autorizo"
          escondido num link pequeno é recusa desencorajada, e consentimento
          desencorajado não é livre.
        */}
        <div className="flex flex-col gap-2">
          <Button
            disabled={!nome.trim() || responder.isPending}
            onClick={() => responder.mutate({ token, autoriza: true, acceptedBy: nome.trim() })}
          >
            Autorizo a identificação facial
          </Button>
          <Button
            variant="secondary"
            disabled={!nome.trim() || responder.isPending}
            onClick={() => responder.mutate({ token, autoriza: false, acceptedBy: nome.trim() })}
          >
            Não autorizo
          </Button>
        </div>
      </Card>
    </Casca>
  );
}

/** Etapa 1: nenhum dado do aluno aparece antes da conferência. */
function Conferencia({
  token,
  escola,
  ano,
  onConferido,
}: {
  token: string;
  escola: string;
  ano: number;
  onConferido: (ficha: Ficha) => void;
}) {
  const trpc = useTRPC();
  const [birthDate, setBirthDate] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const conferir = useMutation(
    trpc.enrollmentLink.verify.mutationOptions({
      onSuccess: (dados) => onConferido(dados as Ficha),
      onError: (falha) => setErro(falha.message),
    }),
  );

  const bloqueado = conferir.error?.data?.code === "TOO_MANY_REQUESTS";
  if (bloqueado) {
    return <Recusa codigo="TOO_MANY_REQUESTS" mensagem={conferir.error?.message ?? ""} />;
  }

  return (
    <Casca escola={escola}>
      <Card className="flex w-full max-w-md flex-col gap-4">
        <div>
          <CardEyebrow>Matrícula {ano || ""}</CardEyebrow>
          <h1 className="mt-1 font-extrabold text-lg tracking-[-0.3px]">Confirme para continuar</h1>
          <p className="mt-1 text-corpo text-muted-foreground">
            Para proteger os dados do aluno, informe a data de nascimento dele.
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setErro(null);
            conferir.mutate({ token, birthDate });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nascimento">Data de nascimento do aluno</Label>
            <Input
              id="nascimento"
              type="date"
              required
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            {erro ? <p className="text-danger text-meta">{erro}</p> : null}
          </div>

          <Button type="submit" size="lg" disabled={conferir.isPending || !birthDate}>
            {conferir.isPending ? "Conferindo…" : "Continuar"}
          </Button>
        </form>

        <p className="text-center text-meta text-muted-foreground">
          Não sabe informar? Fale com a secretaria da escola.
        </p>
      </Card>
    </Casca>
  );
}

/** Etapa 2: a ficha pré-preenchida, para conferir e corrigir. */
function Formulario({
  token,
  ficha,
  onEnviado,
}: {
  token: string;
  ficha: Ficha;
  onEnviado: (dados: { protocol: string; submittedAt: Date }) => void;
}) {
  const trpc = useTRPC();
  const [nome, setNome] = useState(ficha.student.name);
  const [responsavel, setResponsavel] = useState(ficha.guardian?.name ?? "");
  const [parentesco, setParentesco] = useState<Parentesco>(
    (ficha.guardian?.relationship as Parentesco) ?? "responsavel_legal",
  );
  // Mostrado no formato que a pessoa usa; o servidor normaliza de volta
  // para E.164 ao receber.
  const [celular, setCelular] = useState(phoneText(ficha.guardian?.phoneE164) ?? "");
  const [email, setEmail] = useState(ficha.guardian?.email ?? "");
  const [aceitoPor, setAceitoPor] = useState(ficha.guardian?.name ?? "");
  const [termos, setTermos] = useState(false);
  const [imagem, setImagem] = useState(false);
  const [comunicacao, setComunicacao] = useState(false);
  const [biometria, setBiometria] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useMutation(
    trpc.enrollmentLink.submit.mutationOptions({
      onSuccess: (dados) =>
        onEnviado({ protocol: dados.protocol, submittedAt: new Date(dados.submittedAt) }),
      onError: (falha) => setErro(falha.message),
    }),
  );

  return (
    <Casca escola={ficha.schoolName}>
      <Card className="flex w-full max-w-md flex-col gap-4">
        <Passos atual={2} total={3} rotulo="Confira os dados" />

        <div>
          <h1 className="font-extrabold text-lg tracking-[-0.3px]">{ficha.student.name}</h1>
          <p className="text-corpo text-muted-foreground">
            Matrícula {ficha.academicYear} · corrija o que estiver desatualizado.
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setErro(null);
            enviar.mutate({
              token,
              student: { name: nome },
              guardian: {
                name: responsavel,
                relationship: parentesco,
                phoneE164: celular,
                email: email.trim() || null,
              },
              consents: {
                termos_matricula: true,
                uso_imagem: imagem,
                comunicacao,
                biometria,
              },
              acceptedBy: aceitoPor,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aluno">Nome completo do aluno</Label>
            <Input id="aluno" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="responsavel">Nome do responsável</Label>
            <Input
              id="responsavel"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="parentesco">Parentesco</Label>
            <Select
              items={PARENTESCOS.map((o) => ({ value: o.value, label: o.label }))}
              value={parentesco}
              onValueChange={(valor) => setParentesco(valor as Parentesco)}
            >
              <SelectTrigger id="parentesco">
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
            <Label htmlFor="celular">Celular</Label>
            <Input
              id="celular"
              inputMode="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 border-border border-t pt-4">
            <Consentimento
              id="termos"
              checked={termos}
              onChange={setTermos}
              titulo="Li e aceito os termos da matrícula"
              detalhe={`versão ${ficha.termVersion} · obrigatório`}
            />
            <Consentimento
              id="imagem"
              checked={imagem}
              onChange={setImagem}
              titulo="Autorizo o uso de imagem do aluno"
              detalhe="opcional · pode ser revogado depois"
            />
            <Consentimento
              id="comunicacao"
              checked={comunicacao}
              onChange={setComunicacao}
              titulo="Aceito receber avisos da escola"
              detalhe="opcional"
            />
            <Consentimento
              id="biometria"
              checked={biometria}
              onChange={setBiometria}
              titulo="Autorizo a identificação facial na entrada"
              detalhe="opcional · sem ela, o aluno entra pela carteirinha"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aceito-por">Seu nome completo</Label>
            <Input
              id="aceito-por"
              value={aceitoPor}
              onChange={(e) => setAceitoPor(e.target.value)}
              required
            />
            <span className="text-meta text-muted-foreground">
              Fica registrado junto com o aceite.
            </span>
          </div>

          {erro ? <p className="text-danger text-meta">{erro}</p> : null}

          <Button type="submit" size="lg" disabled={enviar.isPending || !termos}>
            {enviar.isPending ? "Enviando…" : "Confirmar meus dados"}
          </Button>
          {!termos ? (
            <p className="text-center text-meta text-muted-foreground">
              É preciso aceitar os termos da matrícula para enviar.
            </p>
          ) : null}
        </form>
      </Card>
    </Casca>
  );
}

function Comprovante({
  protocolo,
  quando,
  escola,
}: {
  protocolo: string;
  quando: Date;
  escola: string;
}) {
  return (
    <Casca escola={escola}>
      <Card className="flex w-full max-w-md flex-col gap-4">
        <Estado
          tom="success"
          icone={<Check size={22} strokeWidth={2} aria-hidden />}
          titulo="Ficha enviada"
          descricao="A secretaria vai conferir e confirmar a matrícula. Você será avisado quando isso acontecer."
        />
        <div className="rounded-card bg-muted p-4 text-center">
          <CardEyebrow>Protocolo</CardEyebrow>
          <p className="mt-1 font-extrabold text-lg tabular-nums tracking-[0.5px]">{protocolo}</p>
          <p className="mt-1 text-meta text-muted-foreground">{dateTimeText(quando)}</p>
        </div>
        <p className="text-center text-meta text-muted-foreground">
          Guarde este número. Ele identifica seu envio se precisar falar com a escola.
        </p>
      </Card>
    </Casca>
  );
}

/**
 * Link que não serve mais.
 *
 * Conferência recusada não chega aqui: ela é erro de campo, e não diz se o
 * link existe. Vencido e bloqueado dizem o motivo, porque quem os vê já
 * possuía o link e precisa saber o que fazer.
 */
function Recusa({ codigo, mensagem }: { codigo?: string; mensagem: string }) {
  if (codigo === "TOO_MANY_REQUESTS") {
    return (
      <Casca>
        <Card className="w-full max-w-md">
          <Estado
            tom="danger"
            icone={<Lock size={22} strokeWidth={1.8} aria-hidden />}
            titulo="Link bloqueado"
            descricao="Houve tentativas demais de abrir esta matrícula. Por segurança, o link foi desativado. A secretaria pode emitir um novo."
          />
        </Card>
      </Casca>
    );
  }

  if (codigo === "PRECONDITION_FAILED") {
    return (
      <Casca>
        <Card className="flex w-full max-w-md flex-col gap-4">
          <Estado
            tom="warning"
            icone={<Clock size={22} strokeWidth={1.8} aria-hidden />}
            titulo="Este link não vale mais"
            descricao={mensagem}
          />
          <Alert>
            <AlertTitle>Como resolver</AlertTitle>
            <AlertDescription>
              Peça um link novo à secretaria da escola. Leva um minuto, e o prazo recomeça.
            </AlertDescription>
          </Alert>
        </Card>
      </Casca>
    );
  }

  return (
    <Casca>
      <Card className="w-full max-w-md">
        <Estado
          tom="danger"
          icone={<TriangleAlert size={22} strokeWidth={1.8} aria-hidden />}
          titulo="Link inválido"
          descricao="Confira se o endereço foi copiado inteiro. Se o problema continuar, fale com a secretaria da escola."
        />
      </Card>
    </Casca>
  );
}

function Estado({
  tom,
  icone,
  titulo,
  descricao,
}: {
  tom: "success" | "warning" | "danger" | "info";
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  const tons = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  } as const;

  return (
    <div className="flex flex-col items-center gap-2.5 py-2 text-center">
      <span className={`grid size-12 place-items-center rounded-control ${tons[tom]}`}>
        {icone}
      </span>
      <h1 className="font-extrabold text-base">{titulo}</h1>
      <p className="max-w-xs text-apoio text-muted-foreground leading-relaxed">{descricao}</p>
    </div>
  );
}

function Consentimento({
  id,
  checked,
  onChange,
  titulo,
  detalhe,
}: {
  id: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(valor) => onChange(valor === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
        <span className="font-bold text-apoio">{titulo}</span>
        <span className="text-meta text-muted-foreground">{detalhe}</span>
      </Label>
    </div>
  );
}

/** Casca da página pública: sem menu, sem barra de contexto, sem sessão. */
function Casca({ children, escola }: { children: React.ReactNode; escola?: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <OrbitaBrand titulo="Órbita Edu" className="w-36 text-primary" />
          {escola ? <span className="text-meta text-muted-foreground">{escola}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
