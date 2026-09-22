import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { ErrorState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Blocks, CalendarDays, GraduationCap, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { CampoDeData } from "@/components/campo-de-data";
import { authClient } from "@/lib/auth-client";
import { dataDoInstante, inteiro } from "@/lib/format";
import { roleLabel } from "@/lib/navigation";
import { useSchoolContext } from "@/lib/school-context";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Configuracoes,
});

type Visao = RouterOutputs["settings"]["overview"];

/**
 * Configurações da instituição.
 *
 * Só quem tem `organization: ["update"]` abre — na prática, direção e
 * secretaria. O item nem aparece no menu dos outros papéis, mas quem forjar a
 * rota esbarra no servidor, que é onde a barreira de verdade mora.
 *
 * A tela é deliberadamente curta em campos editáveis e longa em explicação.
 * O que o sistema **não** deixa configurar é tão importante quanto o que
 * deixa: sem a lista de regras em vigor, a direção passa a tarde procurando um
 * botão para baixar a frequência mínima, que não existe e não deve existir.
 */
function Configuracoes() {
  const trpc = useTRPC();
  const visao = useQuery({ ...trpc.settings.overview.queryOptions(), retry: false });

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Configurações</h1>
        <p className="text-corpo text-muted-foreground">
          Dados da escola, ano letivo, quem tem acesso e as regras em vigor.
        </p>
      </div>

      {visao.isLoading ? (
        <Card>
          <ListSkeleton rows={5} />
        </Card>
      ) : visao.isError ? (
        <Card>
          {/* 403 aqui é resposta esperada, não falha: professor e aluno têm
              `organization: []`. Tratar como erro genérico diria "tente de
              novo" para quem nunca vai conseguir. */}
          {visao.error.data?.code === "FORBIDDEN" ? (
            <PermissionState
              title="Esta área é da direção"
              description="As configurações da instituição são de quem responde pela escola. Seu perfil continua em Meu perfil."
            />
          ) : (
            <ErrorState
              title="Não foi possível carregar as configurações"
              description="Atualize a página em instantes."
            />
          )}
        </Card>
      ) : visao.data ? (
        <>
          <DadosDaInstituicao visao={visao.data} />
          <AnoLetivo />
          <Acessos visao={visao.data} />
          <RegrasEmVigor visao={visao.data} />
        </>
      ) : null}
    </>
  );
}

function DadosDaInstituicao({ visao }: { visao: Visao }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const escola = visao.escola;

  const salvarInep = useMutation(trpc.settings.updateSchool.mutationOptions());

  const form = useForm({
    defaultValues: { name: escola.name, inepCode: escola.inepCode ?? "" },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(3, "O nome da escola precisa de ao menos 3 caracteres")
          .max(120, "O nome passou de 120 caracteres"),
        inepCode: z
          .string()
          .trim()
          .refine((v) => v === "" || /^\d{8}$/.test(v), "O código INEP tem exatamente 8 dígitos"),
      }),
    },
    /**
     * Um formulário, dois donos. O nome vive em `organization`, que é do
     * Better Auth; o INEP vive em `school`, que é nosso. Cada campo só é
     * enviado se mudou — assim um erro num deles não desfaz o outro, e a
     * mensagem diz exatamente o que ficou de fora.
     */
    onSubmit: async ({ value, formApi }) => {
      const nome = value.name.trim();
      const inep = value.inepCode.trim();
      const salvou: string[] = [];

      if (nome !== escola.name) {
        const { error } = await authClient.organization.update({
          organizationId: escola.id,
          data: { name: nome },
        });
        if (error) {
          toast.error(error.message ?? "Não foi possível salvar o nome da escola.");
          return;
        }
        salvou.push("nome");
      }

      if (inep !== (escola.inepCode ?? "")) {
        try {
          await salvarInep.mutateAsync({ inepCode: inep });
          salvou.push("código INEP");
        } catch (erro) {
          toast.error(
            salvou.length > 0
              ? "O nome foi salvo, mas o código INEP não. Tente de novo só o código."
              : ((erro as Error).message ?? "Não foi possível salvar o código INEP."),
          );
          return;
        }
      }

      if (salvou.length === 0) return;

      toast.success(`Salvo: ${salvou.join(" e ")}.`);
      formApi.reset({ name: nome, inepCode: inep });
      // O nome da escola aparece na barra de contexto de toda tela e vem do
      // `me`; sem invalidar, o cabeçalho continuaria com o nome antigo.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [["settings"]] }),
        queryClient.invalidateQueries({ queryKey: [["me"]] }),
      ]);
    },
  });

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback>{initialsOf(escola.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <CardEyebrow>Instituição</CardEyebrow>
          <p className="truncate font-extrabold text-lg tracking-[-0.3px]">{escola.name}</p>
          <p className="text-apoio text-muted-foreground">
            No Órbita Edu desde {dataDoInstante(escola.criadaEm)}
          </p>
        </div>
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Nome da instituição</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(evento) => field.handleChange(evento.target.value)}
                />
                <p className="text-meta text-muted-foreground">
                  Aparece no topo de toda tela e nos comunicados.
                </p>
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="inepCode">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Código INEP</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="00000000"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  // Só dígitos entram: o código é numérico, e deixar letra
                  // passar até o servidor só devolve erro para quem digitou.
                  onChange={(evento) =>
                    field.handleChange(evento.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                />
                <p className="text-meta text-muted-foreground">
                  Oito dígitos do Censo Escolar. Deixe em branco se a escola ainda não tem.
                </p>
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFixo
            rotulo="Identificador"
            valor={escola.slug}
            nota="Definido no provisionamento. Mudar quebraria o vínculo com o que já foi emitido."
          />
          <CampoFixo
            rotulo="Fuso horário"
            valor={escola.timezone}
            nota="Fixo nesta versão: o servidor ainda formata toda data em America/Sao_Paulo."
          />
        </div>

        <form.Subscribe
          selector={(estado) => ({
            podeEnviar: estado.canSubmit,
            enviando: estado.isSubmitting,
            sujo: estado.isDirty,
          })}
        >
          {({ podeEnviar, enviando, sujo }) => (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!podeEnviar || enviando || !sujo}>
                {enviando ? "Salvando…" : "Salvar alterações"}
              </Button>
              {sujo ? (
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
                  Desfazer
                </Button>
              ) : null}
            </div>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}

/**
 * O período do ano letivo, com a contagem de dias ao lado.
 *
 * Mora aqui **e** no calendário de propósito: é a mesma procedure, e este é o
 * lugar onde a direção procura ("configurações"), enquanto o calendário é onde
 * quem monta o ano está trabalhando. Duas portas, um dado.
 */
function AnoLetivo() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();

  const ano = useQuery(trpc.calendar.year.queryOptions({ academicYear: year }));
  const contagem = ano.data?.contagem;
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
        <CardEyebrow>Ano letivo</CardEyebrow>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">Período de {year}</h2>
        <p className="text-corpo text-muted-foreground">
          É o que delimita o calendário: evento fora deste período é recusado, e a contagem de dias
          letivos parte daqui.
        </p>
      </div>

      {ano.isLoading ? (
        <ListSkeleton rows={2} />
      ) : (
        <>
          {contagem ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard icon={CalendarDays} label="Dias letivos" hint="úteis − perdidos + repostos">
                {inteiro(contagem.letivos)}
              </StatCard>
              <StatCard icon={CalendarDays} label="Mínimo exigido" hint="LDB, art. 24, I">
                {inteiro(contagem.minimo)}
              </StatCard>
              <StatCard
                icon={CalendarDays}
                label="Faltam"
                hint={contagem.cumpreOMinimo ? "mínimo cumprido" : "para cumprir o mínimo"}
                tone={contagem.cumpreOMinimo ? undefined : "warning"}
              >
                {inteiro(contagem.faltam)}
              </StatCard>
            </div>
          ) : (
            <Alert variant="warning">
              <AlertTitle>O ano letivo de {year} ainda não foi definido</AlertTitle>
              <AlertDescription>
                Sem o período, não dá para criar evento no calendário nem contar dias letivos.
              </AlertDescription>
            </Alert>
          )}

          <FormularioDoAno definido={ano.data?.ano ?? null} />
        </>
      )}
    </Card>
  );
}

/**
 * O formulário do período, montado **só depois** que a consulta responde.
 *
 * `useForm` congela os `defaultValues` na primeira renderização. Deixá-lo no
 * componente de cima faria o formulário nascer vazio sempre que a consulta
 * ainda não tivesse respondido — e a direção veria os campos em branco numa
 * escola cujo ano letivo já está definido, o que convida a redefinir por cima.
 * Montar o formulário junto com o dado elimina a corrida em vez de remendá-la
 * com um `reset` num efeito.
 */
function FormularioDoAno({
  definido,
}: {
  definido: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();

  const definir = useMutation(
    trpc.calendar.defineYear.mutationOptions({
      onSuccess: async () => {
        toast.success(`Ano letivo de ${year} definido.`);
        await queryClient.invalidateQueries({ queryKey: [["calendar"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      startsOn: definido?.startsOn ?? "",
      endsOn: definido?.endsOn ?? "",
      minimumSchoolDays: String(definido?.minimumSchoolDays ?? 200),
    },
    validators: {
      onSubmit: z
        .object({
          startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início"),
          endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de término"),
          minimumSchoolDays: z
            .string()
            .refine((v) => Number(v) >= 1 && Number(v) <= 365, "Entre 1 e 365 dias"),
        })
        .refine((v) => v.startsOn <= v.endsOn, {
          message: "O fim não pode ser antes do início",
          path: ["endsOn"],
        }),
    },
    onSubmit: async ({ value }) => {
      await definir.mutateAsync({
        academicYear: year,
        startsOn: value.startsOn,
        endsOn: value.endsOn,
        minimumSchoolDays: Number(value.minimumSchoolDays),
      });
    },
  });

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <form.Field name="startsOn">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <CampoDeData
                id={field.name}
                label="Início"
                value={field.state.value}
                // O campo devolve `null` enquanto a data está
                // incompleta; o formulário guarda string, e o validador
                // recusa o vazio com a mensagem certa.
                onChange={(iso) => field.handleChange(iso ?? "")}
              />
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="endsOn">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <CampoDeData
                id={field.name}
                label="Término"
                value={field.state.value}
                // O campo devolve `null` enquanto a data está
                // incompleta; o formulário guarda string, e o validador
                // recusa o vazio com a mensagem certa.
                onChange={(iso) => field.handleChange(iso ?? "")}
              />
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="minimumSchoolDays">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Mínimo de dias letivos</Label>
              <Input
                id={field.name}
                name={field.name}
                inputMode="numeric"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(evento) =>
                  field.handleChange(evento.target.value.replace(/\D/g, "").slice(0, 3))
                }
              />
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form.Subscribe
          selector={(estado) => ({
            podeEnviar: estado.canSubmit,
            enviando: estado.isSubmitting,
          })}
        >
          {({ podeEnviar, enviando }) => (
            <Button type="submit" disabled={!podeEnviar || enviando}>
              {enviando ? "Salvando…" : definido ? "Atualizar período" : "Definir período"}
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" nativeButton={false} render={<Link to="/calendario" />}>
          Abrir o calendário
        </Button>
      </div>
    </form>
  );
}

const ORDEM_DOS_PAPEIS = ["owner", "admin", "teacher", "student"] as const;

function Acessos({ visao }: { visao: Visao }) {
  const porPapel = new Map(visao.acessos.map((linha) => [linha.role, linha.total]));

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Users size={18} strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
        <CardEyebrow>Acessos</CardEyebrow>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">Quem entra nesta escola</h2>
        <p className="text-corpo text-muted-foreground">
          Vínculos ativos por papel. Quem cria e remove vínculo é a plataforma, por provisionamento.
        </p>
      </div>

      {/*
        "Aluno: 1" ao lado de "Professor: 20" numa escola com centenas de
        matriculados parece erro, e não é: aqui se conta conta de acesso, não
        matrícula. Dizer isso na tela custa uma linha; deixar a direção
        desconfiar do número custa a confiança no resto.
      */}
      <p className="text-apoio text-muted-foreground">
        Conta de acesso, não matrícula. Aluno sem login continua matriculado, aparece na chamada e
        recebe nota.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {ORDEM_DOS_PAPEIS.map((papel) => (
          <div key={papel} className="flex flex-col gap-0.5 rounded-control bg-muted px-4 py-3">
            <span className="font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]">
              {roleLabel(papel)}
            </span>
            <span className="font-extrabold text-xl tracking-[-0.4px]">
              {inteiro(porPapel.get(papel) ?? 0)}
            </span>
          </div>
        ))}
      </div>

      {/*
        A única lista nominal desta tela, e ela existe por segurança: "quem
        pode mexer em tudo aqui?" é pergunta que hoje só o banco responde.
      */}
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-corpo">Com acesso total</h3>
        {visao.administradores.length === 0 ? (
          <p className="text-apoio text-muted-foreground">
            Nenhum vínculo de direção ou secretaria — o que não deveria acontecer numa escola em
            operação.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visao.administradores.map((pessoa) => (
              <li
                key={pessoa.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-muted px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initialsOf(pessoa.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-corpo">{pessoa.name}</p>
                    <p className="truncate text-meta text-muted-foreground">{pessoa.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-meta text-muted-foreground">
                    {/* `toISOString().slice(0, 10)` daria o dia em UTC: um
                        vínculo criado às 21h em Brasília apareceria no dia
                        seguinte. Formatar no fuso de quem lê não tem esse
                        buraco. */}
                    desde {dataDoInstante(pessoa.desde)}
                  </span>
                  <Badge variant={pessoa.role === "owner" ? "info" : "neutral"}>
                    {roleLabel(pessoa.role === "owner" ? "owner" : "admin")}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" nativeButton={false} render={<Link to="/professores" />}>
          <GraduationCap strokeWidth={1.7} aria-hidden />
          Corpo docente
        </Button>
        <Button variant="secondary" nativeButton={false} render={<Link to="/apps" />}>
          <Blocks strokeWidth={1.7} aria-hidden />
          Apps da escola
        </Button>
      </div>
    </Card>
  );
}

function RegrasEmVigor({ visao }: { visao: Visao }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Lock size={18} strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
        <CardEyebrow>Regras</CardEyebrow>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">O que não se configura</h2>
        <p className="text-corpo text-muted-foreground">
          Regras que valem para esta escola e não mudam por tela — algumas por serem lei, outras por
          ainda não serem configuráveis. Estão aqui para você não procurar um botão que não há.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {visao.regras.map((regra) => (
          <li key={regra.chave} className="flex flex-col gap-1 rounded-control bg-muted px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-bold text-corpo">{regra.titulo}</span>
              <span className="font-extrabold text-corpo text-primary">{regra.valor}</span>
            </div>
            <span className="text-apoio text-muted-foreground">{regra.porque}</span>
            <span className="font-mono text-muted-foreground text-rotulo">{regra.onde}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Mesmo padrão de "Meu perfil": texto, não `<Input disabled>`. */
function CampoFixo({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-control bg-muted px-4 py-3">
      <span className="font-bold text-muted-foreground text-rotulo uppercase tracking-[0.7px]">
        {rotulo}
      </span>
      <span className="truncate font-bold text-corpo">{valor}</span>
      {nota ? <span className="text-meta text-muted-foreground">{nota}</span> : null}
    </div>
  );
}
