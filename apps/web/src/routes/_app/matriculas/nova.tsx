import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Passos } from "@educa-escola/ui/integra/steps";
import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Copy, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { dataHora } from "@/lib/format";
import { dataParaISO, idadeEm, mascararCelular, mascararData } from "@/lib/masks";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/matriculas/nova")({
  component: NovaMatricula,
});

const ANO_LETIVO = new Date().getFullYear();

const PARENTESCOS = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avó ou avô" },
  { value: "responsavel_legal", label: "Responsável legal" },
  { value: "outro", label: "Outro" },
] as const;

const TURNOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

const ETAPAS = ["Aluno", "Responsável", "Turma e prazo"] as const;

/** Validação por etapa: avançar só com a etapa corrente preenchida. */
const esquemas = [
  z.object({
    nome: z.string().trim().min(1, "Informe o nome do aluno"),
    nascimento: z
      .string()
      .refine((valor) => dataParaISO(valor) !== null, "Informe uma data de nascimento válida"),
  }),
  z.object({
    responsavelNome: z.string().trim().min(1, "Informe o nome do responsável"),
    celular: z
      .string()
      .trim()
      .refine((valor) => [10, 11].includes(valor.replace(/\D/g, "").length), {
        message: "Celular inválido: informe DDD e número",
      }),
  }),
  z.object({
    turmaId: z.string().min(1, "Escolha a turma"),
  }),
];

/**
 * Criação de matrícula, em três etapas.
 *
 * Formulário curto por tela em vez de um único longo: é o que o design brief
 * pede, e é o que evita que a secretaria abandone no meio quando falta um dado.
 */
function NovaMatricula() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [criada, setCriada] = useState<{ id: string; url: string; detalhe: string } | null>(null);

  const turmas = useQuery(trpc.classroom.list.queryOptions());
  // Prévia do número. O valor definitivo é resolvido no servidor na criação —
  // duas pessoas cadastrando ao mesmo tempo não podem receber o mesmo.
  const proximaMatricula = useQuery(
    trpc.enrollment.nextRegistration.queryOptions({ academicYear: ANO_LETIVO }),
  );

  const criar = useMutation(
    trpc.enrollment.create.mutationOptions({
      onSuccess: (resultado) => {
        setCriada({ id: resultado.id, url: resultado.url, detalhe: resultado.envio.detail });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      nome: "",
      nascimento: "",
      turno: "manha" as (typeof TURNOS)[number]["value"],
      responsavelNome: "",
      parentesco: "mae" as (typeof PARENTESCOS)[number]["value"],
      celular: "",
      email: "",
      turmaId: "",
      prazoDias: "7",
    },
    onSubmit: async ({ value }) => {
      await criar.mutateAsync({
        student: {
          name: value.nome,
          // Sem `registration`: quem numera é o servidor, em sequência.
          birthDate: dataParaISO(value.nascimento) ?? "",
          shift: value.turno,
        },
        guardian: {
          name: value.responsavelNome,
          relationship: value.parentesco,
          phoneE164: value.celular,
          email: value.email.trim() || null,
        },
        classroomId: value.turmaId,
        academicYear: ANO_LETIVO,
        expiryDays: Number(value.prazoDias),
      });
    },
  });

  if (criada) {
    return <LinkCriado {...criada} />;
  }

  const ultima = etapa === ETAPAS.length - 1;

  const avancar = () => {
    const resultado = esquemas[etapa]?.safeParse(form.state.values);
    if (resultado && !resultado.success) {
      toast.error(resultado.error.issues[0]?.message ?? "Preencha os campos obrigatórios");
      return;
    }
    setEtapa((atual) => atual + 1);
  };

  return (
    <Card className="flex max-w-3xl flex-col gap-5">
      <div>
        <Link
          to="/matriculas"
          className="flex w-fit items-center gap-1.5 font-bold text-[11px] text-muted-foreground"
        >
          <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
          Matrículas
        </Link>
        <h1 className="mt-1 font-extrabold text-2xl tracking-[-0.6px]">Nova matrícula</h1>
        <p className="text-[13px] text-muted-foreground">Ano letivo de {ANO_LETIVO}</p>
      </div>

      <Passos
        atual={etapa + 1}
        total={ETAPAS.length}
        rotulo={ETAPAS[etapa] ?? ""}
        className="max-w-md"
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-5"
      >
        {etapa === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="nome">
              {(field) => <Campo field={field} label="Nome completo do aluno" autoComplete="off" />}
            </form.Field>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="matricula">Número de matrícula</Label>
              <Input
                id="matricula"
                readOnly
                aria-describedby="matricula-hint"
                value={proximaMatricula.data ?? "…"}
                className="font-bold text-muted-foreground tabular-nums"
              />
              <span id="matricula-hint" className="text-[11px] text-muted-foreground">
                Gerado em sequência pelo sistema, no momento em que a matrícula é criada.
              </span>
            </div>
            <form.Field name="nascimento">
              {(field) => (
                <CampoData
                  field={field}
                  label="Data de nascimento"
                  hint="É o dado que o responsável vai digitar para abrir o link."
                />
              )}
            </form.Field>
            <form.Field name="turno">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>Turno</Label>
                  <Select
                    items={TURNOS.map((o) => ({ value: o.value, label: o.label }))}
                    value={field.state.value}
                    onValueChange={(valor) =>
                      field.handleChange((valor ?? "manha") as (typeof TURNOS)[number]["value"])
                    }
                  >
                    <SelectTrigger id={field.name}>
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
              )}
            </form.Field>
          </div>
        )}

        {etapa === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="responsavelNome">
                {(field) => <Campo field={field} label="Nome do responsável" />}
              </form.Field>
              <form.Field name="parentesco">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>Parentesco</Label>
                    <Select
                      items={PARENTESCOS.map((o) => ({ value: o.value, label: o.label }))}
                      value={field.state.value}
                      onValueChange={(valor) =>
                        field.handleChange(
                          (valor ?? "mae") as (typeof PARENTESCOS)[number]["value"],
                        )
                      }
                    >
                      <SelectTrigger id={field.name}>
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
                )}
              </form.Field>
              <form.Field name="celular">
                {(field) => (
                  <Campo
                    field={field}
                    label="Celular com WhatsApp"
                    inputMode="numeric"
                    placeholder="(86) 99999-9999"
                    mascara={mascararCelular}
                    hint="É para este número que o link será enviado."
                  />
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => <Campo field={field} label="E-mail (opcional)" type="email" />}
              </form.Field>
            </div>

            <Alert>
              <Info size={18} strokeWidth={1.7} aria-hidden />
              <AlertTitle>Responsável legal</AlertTitle>
              <AlertDescription>
                Aluno menor de idade precisa de ao menos um responsável legal vinculado. Este entra
                como legal e como contato principal.
              </AlertDescription>
            </Alert>
          </>
        )}

        {etapa === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="turmaId">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>Turma pretendida</Label>
                  <Select
                    items={(turmas.data ?? [])
                      .filter((turma) => turma.academicYear === ANO_LETIVO)
                      .map((turma) => ({ value: turma.id, label: turma.name }))}
                    value={field.state.value}
                    onValueChange={(valor) => field.handleChange(valor ?? "")}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(turmas.data ?? [])
                        .filter((turma) => turma.academicYear === ANO_LETIVO)
                        .map((turma) => (
                          <SelectItem key={turma.id} value={turma.id}>
                            {turma.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-muted-foreground">
                    É dela que sai a série, usada para agrupar as matrículas.
                  </span>
                </div>
              )}
            </form.Field>
            <form.Field name="prazoDias">
              {(field) => (
                <Campo
                  field={field}
                  label="Prazo de confirmação (dias)"
                  type="number"
                  hint="Passado o prazo sem confirmação, a matrícula expira."
                />
              )}
            </form.Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-border border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (etapa === 0 ? navigate({ to: "/matriculas" }) : setEtapa(etapa - 1))}
          >
            Voltar
          </Button>

          {ultima ? (
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(enviando) => (
                <Button type="submit" disabled={enviando || criar.isPending}>
                  {enviando || criar.isPending ? "Criando…" : "Criar e emitir link"}
                </Button>
              )}
            </form.Subscribe>
          ) : (
            <Button type="button" onClick={avancar}>
              Continuar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/**
 * O endereço aparece uma única vez.
 *
 * Enquanto o envio é manual, a secretaria precisa dele para mandar ao
 * responsável — mas guardá-lo na tela do detalhe deixaria o token circulando
 * em print e aba aberta. Quem perder, reemite: o link antigo deixa de valer.
 */
function LinkCriado({ id, url, detalhe }: { id: string; url: string; detalhe: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Card className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-control bg-success-soft text-success">
          <Check size={24} strokeWidth={2} aria-hidden />
        </span>
        <CardEyebrow>Matrícula criada</CardEyebrow>
        <h1 className="font-extrabold text-xl tracking-[-0.4px]">Link de confirmação pronto</h1>
        <p className="max-w-sm text-[13px] text-muted-foreground">{detalhe}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-card bg-muted p-4">
        <span className="font-bold text-[11px] text-secondary-foreground">Endereço do link</span>
        <code className="break-all text-[12px] text-foreground">{url}</code>
        <Button
          variant="secondary"
          className="mt-1 w-fit"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            toast.success("Link copiado.");
          }}
        >
          <Copy size={18} strokeWidth={1.7} aria-hidden />
          {copiado ? "Copiado" : "Copiar link"}
        </Button>
      </div>

      <Alert>
        <Info size={18} strokeWidth={1.7} aria-hidden />
        <AlertTitle>Este endereço não aparece de novo</AlertTitle>
        <AlertDescription>
          Copie agora e mande ao responsável. Se precisar outra vez, reemita pelo detalhe da
          matrícula — o link atual deixa de valer no mesmo instante.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link to="/matriculas/$enrollmentId" params={{ enrollmentId: id }} />}>
          Abrir a matrícula
        </Button>
        <Button variant="secondary" render={<Link to="/matriculas" />}>
          Voltar à fila
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">Criado em {dataHora(new Date())}.</p>
    </Card>
  );
}

/** Campo de texto com rótulo visível e erro abaixo — o padrão do `login.tsx`. */
function Campo({
  field,
  label,
  hint,
  mascara,
  ...props
}: {
  /** `AnyFieldApi` porque o tipo exato do field carrega o formulário inteiro. */
  field: AnyFieldApi;
  label: string;
  hint?: string;
  /** Reformata o que foi digitado antes de guardar no formulário. */
  mascara?: (valor: string) => string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value as string}
        onBlur={field.handleBlur}
        onChange={(event) =>
          field.handleChange(mascara ? mascara(event.target.value) : event.target.value)
        }
        {...props}
      />
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      {field.state.meta.errors.map((error: { message?: string } | undefined) => (
        <p key={error?.message} className="text-[11px] text-danger">
          {error?.message}
        </p>
      ))}
    </div>
  );
}

/**
 * Data de nascimento em campo de texto mascarado, não no seletor nativo.
 *
 * O seletor do navegador abre no mês corrente e obriga a navegar uma década
 * para trás para achar 2015 — para data de nascimento ele é o controle errado.
 * Aqui a pessoa digita oito dígitos seguidos e as barras aparecem sozinhas.
 *
 * A idade ao lado é a conferência: digitar 2051 no lugar de 2015 vira
 * "idade −25" na hora, em vez de virar uma matrícula errada.
 */
function CampoData({ field, label, hint }: { field: AnyFieldApi; label: string; hint?: string }) {
  const valor = field.state.value as string;
  const iso = dataParaISO(valor);
  const idade = idadeEm(iso);
  const completo = valor.replace(/\D/g, "").length === 8;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <div className="relative">
        <Input
          id={field.name}
          name={field.name}
          inputMode="numeric"
          autoComplete="bday"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          className="pr-20 tabular-nums"
          value={valor}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(mascararData(event.target.value))}
        />
        {idade !== null ? (
          <span
            className={
              idade < 0 || idade > 120
                ? "absolute top-1/2 right-3 -translate-y-1/2 font-bold text-[11px] text-danger"
                : "absolute top-1/2 right-3 -translate-y-1/2 font-bold text-[11px] text-muted-foreground"
            }
          >
            {idade} anos
          </span>
        ) : null}
      </div>
      {completo && !iso ? (
        <p className="text-[11px] text-danger">Esta data não existe no calendário.</p>
      ) : hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
      {field.state.meta.errors.map((error: { message?: string } | undefined) => (
        <p key={error?.message} className="text-[11px] text-danger">
          {error?.message}
        </p>
      ))}
    </div>
  );
}
