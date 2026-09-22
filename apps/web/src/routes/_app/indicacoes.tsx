import {
  REFERER_KIND_LABEL,
  REFERER_KIND_NOTA,
  REFERER_KINDS,
  REWARD_KIND_LABEL,
  REWARD_KINDS,
  type RefererKind,
  type RewardKind,
} from "@educa-escola/api/modules/referral/schema";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { Textarea } from "@educa-escola/ui/components/textarea";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Gift, Share2, TriangleAlert, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { dataDoInstante, inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/indicacoes")({
  component: Indicacoes,
});

type Visao = RouterOutputs["referral"]["overview"];
type MeuPainel = RouterOutputs["referral"]["meuPainel"];
type Indicacao = Visao["indicacoes"][number];

const SITUACAO = {
  confirmada: { rotulo: "Desconto confirmado", tom: "success" },
  pendente: { rotulo: "Aguardando matrícula", tom: "warning" },
  acima_do_teto: { rotulo: "Acima do limite", tom: "neutral" },
  sem_efeito: { rotulo: "Sem efeito", tom: "neutral" },
} as const;

/** 1500 centavos -> "R$ 15,00". Dinheiro não passa por ponto flutuante. */
function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function premio(kind: RewardKind, value: number): string {
  return kind === "percentual" ? `${value}% da mensalidade` : reais(value);
}

/**
 * Programa de indicações.
 *
 * Uma rota, duas telas. A gestão desenha a regra e vê quem indicou quem — que
 * é lista nominal de família, atrás de `referral: ["read"]`. Quem divulga vê
 * só o próprio link, por identidade. O mesmo desenho de `/frequencia`.
 */
function Indicacoes() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();

  const me = useQuery(trpc.me.queryOptions());
  const daGestao = me.data?.role === "owner" || me.data?.role === "admin";

  if (me.isLoading) {
    return (
      <Card>
        <ListSkeleton rows={4} />
      </Card>
    );
  }

  return daGestao ? <PainelDaGestao ano={year} /> : <MeuLink ano={year} />;
}

function PainelDaGestao({ ano }: { ano: number }) {
  const trpc = useTRPC();
  const visao = useQuery({
    ...trpc.referral.overview.queryOptions({ academicYear: ano }),
    retry: false,
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Secretaria</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Indicações</h1>
        <p className="text-corpo text-muted-foreground">
          O programa de desconto por indicação e quem já trouxe matrícula em {ano}.
        </p>
      </div>

      {visao.isLoading ? (
        <Card>
          <ListSkeleton rows={5} />
        </Card>
      ) : visao.isError || !visao.data ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar as indicações"
            description={visao.error?.message ?? "Atualize a página em instantes."}
          />
        </Card>
      ) : (
        <>
          <Numeros visao={visao.data} />
          <Programa programa={visao.data.programa} />
          <EmitirCodigo ativo={visao.data.programa.enabled} />
          <RegistrarIndicacao ativo={visao.data.programa.enabled} />
          <ListaDeIndicacoes indicacoes={visao.data.indicacoes} ano={ano} />
        </>
      )}
    </>
  );
}

function Numeros({ visao }: { visao: Visao }) {
  const { resumo, programa } = visao;

  return (
    <>
      {programa.enabled ? null : (
        <Alert variant="warning">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
          <AlertTitle>O programa está desligado</AlertTitle>
          <AlertDescription>
            Ninguém consegue gerar link nem registrar indicação enquanto ele estiver assim. Nasce
            desligado de propósito: desconto é receita comprometida, e isso é decisão da direção.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Users} label="Famílias com link" hint="quem pode divulgar">
          {inteiro(visao.familias)}
        </StatCard>
        <StatCard
          icon={Share2}
          label="Indicações"
          hint={`registradas em ${new Date().getFullYear()}`}
        >
          {inteiro(visao.indicacoes.length)}
        </StatCard>
        <StatCard
          icon={Gift}
          label="Descontos confirmados"
          tone="success"
          hint="matrícula efetivada"
        >
          {inteiro(resumo.confirmadas)}
        </StatCard>
        <StatCard icon={Gift} label="Aguardando" tone="warning" hint="matrícula ainda pendente">
          {inteiro(resumo.pendentes)}
        </StatCard>
      </div>
    </>
  );
}

function Programa({ programa }: { programa: Visao["programa"] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const salvar = useMutation(
    trpc.referral.updateProgram.mutationOptions({
      onSuccess: async () => {
        toast.success("Programa atualizado.");
        await queryClient.invalidateQueries({ queryKey: [["referral"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      enabled: programa.enabled,
      headline: programa.headline,
      description: programa.description ?? "",
      terms: programa.terms ?? "",
      rewardKind: programa.rewardKind as RewardKind,
      rewardValue: String(programa.rewardValue),
      rewardCapPerYear: String(programa.rewardCapPerYear),
      linkExpiresInDays: String(programa.linkExpiresInDays),
      whoCanRefer: programa.whoCanRefer as RefererKind,
    },
    validators: {
      onSubmit: z
        .object({
          enabled: z.boolean(),
          headline: z.string().trim().min(3, "Informe o título do programa").max(80),
          description: z.string().trim().max(400),
          terms: z.string().trim().max(4000),
          rewardKind: z.enum(REWARD_KINDS),
          rewardValue: z.string().refine((v) => Number(v) >= 1, "Informe o valor do desconto"),
          rewardCapPerYear: z
            .string()
            .refine((v) => Number(v) >= 1 && Number(v) <= 50, "Entre 1 e 50 indicações"),
          linkExpiresInDays: z
            .string()
            .refine((v) => Number(v) >= 0 && Number(v) <= 730, "Entre 0 e 730 dias"),
          whoCanRefer: z.enum(REFERER_KINDS),
        })
        .refine((v) => v.rewardKind !== "percentual" || Number(v.rewardValue) <= 100, {
          message: "Um desconto percentual não passa de 100%",
          path: ["rewardValue"],
        }),
    },
    onSubmit: async ({ value, formApi }) => {
      await salvar.mutateAsync({
        enabled: value.enabled,
        headline: value.headline.trim(),
        description: value.description.trim() || null,
        terms: value.terms.trim() || null,
        rewardKind: value.rewardKind,
        rewardValue: Number(value.rewardValue),
        rewardCapPerYear: Number(value.rewardCapPerYear),
        linkExpiresInDays: Number(value.linkExpiresInDays),
        whoCanRefer: value.whoCanRefer,
      });
      formApi.reset({ ...value });
    },
  });

  const tipos = REWARD_KINDS.map((k) => ({ value: k, label: REWARD_KIND_LABEL[k] }));
  const divulgadores = REFERER_KINDS.map((k) => ({ value: k, label: REFERER_KIND_LABEL[k] }));

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <CardEyebrow>Programa</CardEyebrow>
        <h2 className="font-extrabold text-card tracking-[-0.3px]">Como funciona o desconto</h2>
        <p className="text-corpo text-muted-foreground">
          O que estiver aqui vale para as indicações registradas de agora em diante. O prêmio é
          congelado no dia do registro — mudar a regra em março não altera o desconto de quem
          indicou em fevereiro.
        </p>
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <form.Field name="enabled">
          {(field) => (
            <label className="flex items-start gap-2.5 rounded-control bg-muted px-4 py-3 text-corpo">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={field.state.value}
                onChange={(evento) => field.handleChange(evento.target.checked)}
              />
              <span>
                Programa ligado
                <span className="block text-meta text-muted-foreground">
                  Desligado, ninguém gera link nem registra indicação. O que já foi registrado
                  continua valendo.
                </span>
              </span>
            </label>
          )}
        </form.Field>

        <form.Field name="headline">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Título, como a família vê</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                maxLength={80}
              />
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Chamada (opcional)</Label>
              <Textarea
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                maxLength={400}
                placeholder="Indique uma família e ganhe desconto na próxima mensalidade."
              />
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <form.Field name="rewardKind">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={field.name}>Tipo do desconto</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange((v as RewardKind) ?? "percentual")}
                  items={tipos}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(estado) => estado.values.rewardKind}>
            {(kind) => (
              <form.Field name="rewardValue">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={field.name}>
                      {kind === "percentual" ? "Percentual (%)" : "Valor (centavos)"}
                    </Label>
                    <Input
                      id={field.name}
                      inputMode="numeric"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value.replace(/\D/g, ""))}
                    />
                    {/* Centavos na tela porque é como fica guardado. Mostrar
                        "R$ 150,00" num campo que grava 15000 é a origem
                        clássica do desconto errado por fator de 100. */}
                    <p className="text-meta text-muted-foreground">
                      {kind === "percentual"
                        ? "Sobre a mensalidade de quem indicou."
                        : `Equivale a ${reais(Number(field.state.value) || 0)}.`}
                    </p>
                    {field.state.meta.errors.map((erro) => (
                      <p key={erro?.message} className="text-danger text-meta">
                        {erro?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            )}
          </form.Subscribe>

          <form.Field name="rewardCapPerYear">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={field.name}>Máximo por ano</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                />
                {/* Sem teto, 10% com dez indicações zera a mensalidade — e o
                    incentivo passa a ser caçar matrícula, não indicar quem
                    tem perfil para a escola. */}
                <p className="text-meta text-muted-foreground">
                  Indicações premiadas por família, por ano.
                </p>
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="linkExpiresInDays">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={field.name}>Validade do link (dias)</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                />
                <p className="text-meta text-muted-foreground">Zero significa sem prazo.</p>
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="whoCanRefer">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Quem divulga</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange((v as RefererKind) ?? "responsavel")}
                items={divulgadores}
              >
                <SelectTrigger id={field.name} className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {divulgadores.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/*
                A consequência jurídica da escolha, ao lado do campo e no
                momento em que a direção escolhe — não num documento que
                ninguém abre. Ver `REFERER_KIND_NOTA` no schema do módulo.
              */}
              <Alert variant={field.state.value === "responsavel" ? "info" : "warning"}>
                <AlertDescription>{REFERER_KIND_NOTA[field.state.value]}</AlertDescription>
              </Alert>
            </div>
          )}
        </form.Field>

        <form.Field name="terms">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Regulamento (opcional)</Label>
              <Textarea
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                maxLength={4000}
                className="min-h-32"
                placeholder="Quando o desconto é aplicado, em qual mensalidade, e o que acontece se a matrícula indicada for cancelada."
              />
              <p className="text-meta text-muted-foreground">
                Fica guardado, não só exibido: é o texto que a família vai cobrar depois.
              </p>
            </div>
          )}
        </form.Field>

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
                {enviando ? "Salvando…" : "Salvar programa"}
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
 * Emite o código de uma família.
 *
 * Sob demanda, e não para os 289 alunos de uma vez: a maioria nunca vai
 * divulgar nada, e trezentas linhas ociosas só atrapalham quem depois precisa
 * achar as que importam. Pedir duas vezes devolve o mesmo código — o link é
 * um por aluno, para sempre.
 */
function EmitirCodigo({ ativo }: { ativo: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [emitido, setEmitido] = useState<{ nome: string; codigo: string } | null>(null);

  const alunos = useQuery({
    ...trpc.student.list.queryOptions({ search: busca.trim(), limit: 8, offset: 0 }),
    // Sem busca a lista seria "os oito primeiros da escola", que não ajuda
    // ninguém a achar a família que pediu o código no balcão.
    enabled: ativo && busca.trim().length >= 2,
  });

  const gerar = useMutation(
    trpc.referral.gerarLink.mutationOptions({
      onSuccess: async (dados) => {
        setEmitido({ nome: dados.aluno.name, codigo: dados.link.code });
        await queryClient.invalidateQueries({ queryKey: [["referral"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (!ativo) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardEyebrow>Emitir</CardEyebrow>
        <h2 className="font-extrabold text-card tracking-[-0.3px]">Código de uma família</h2>
        <p className="text-corpo text-muted-foreground">
          Busque o aluno e emita o código. Se ele já tiver um, o mesmo aparece de novo.
        </p>
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar aluno por nome ou matrícula"
        aria-label="Buscar aluno para emitir código"
      />

      {emitido ? (
        <Alert variant="success">
          <AlertTitle>
            {emitido.nome}: {emitido.codigo}
          </AlertTitle>
          <AlertDescription>
            Anote ou dite para a família. O código é o mesmo em toda consulta futura.
          </AlertDescription>
        </Alert>
      ) : null}

      {busca.trim().length >= 2 && alunos.data ? (
        alunos.data.items.length === 0 ? (
          <EmptyState title="Nenhum aluno encontrado" description="Ajuste a busca." />
        ) : (
          <ul className="flex flex-col">
            {alunos.data.items.map((aluno) => (
              <li
                key={aluno.id}
                className="flex flex-wrap items-center gap-3 border-border border-t py-2.5 text-corpo first:border-t-0"
              >
                <span className="min-w-0 flex-1 font-bold">{aluno.name}</span>
                <span className="text-meta text-muted-foreground">{aluno.registration}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => gerar.mutate({ studentId: aluno.id })}
                  disabled={gerar.isPending}
                >
                  Emitir código
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}

/**
 * Amarra uma matrícula já criada a um código.
 *
 * Passo separado da criação da matrícula de propósito: são dois serviços, e
 * emendá-los numa mutation só deixaria a secretaria com uma matrícula criada e
 * um erro de indicação na tela, sem saber o que foi gravado. Aqui a matrícula
 * já existe, e o que falha é só o vínculo.
 */
function RegistrarIndicacao({ ativo }: { ativo: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [enrollmentId, setEnrollmentId] = useState("");
  const [codigo, setCodigo] = useState("");

  const registrar = useMutation(
    trpc.referral.registrar.mutationOptions({
      onSuccess: async () => {
        toast.success("Indicação registrada.");
        setEnrollmentId("");
        setCodigo("");
        await queryClient.invalidateQueries({ queryKey: [["referral"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (!ativo) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardEyebrow>Registrar</CardEyebrow>
        <h2 className="font-extrabold text-card tracking-[-0.3px]">
          Esta matrícula veio de indicação
        </h2>
        <p className="text-corpo text-muted-foreground">
          Cole o número da matrícula e o código que a família informou.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <Label htmlFor="matricula-indicada">Matrícula</Label>
          <Input
            id="matricula-indicada"
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
            placeholder="Identificador da matrícula"
          />
        </div>
        <div className="flex min-w-40 flex-col gap-2">
          <Label htmlFor="codigo-indicacao">Código</Label>
          <Input
            id="codigo-indicacao"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="MA4K2Z"
            maxLength={24}
          />
        </div>
        <Button
          onClick={() =>
            registrar.mutate({ enrollmentId: enrollmentId.trim(), code: codigo.trim() })
          }
          disabled={
            registrar.isPending || enrollmentId.trim().length < 4 || codigo.trim().length < 4
          }
        >
          Registrar
        </Button>
      </div>
    </Card>
  );
}

function ListaDeIndicacoes({ indicacoes, ano }: { indicacoes: Indicacao[]; ano: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const remover = useMutation(
    trpc.referral.remover.mutationOptions({
      onSuccess: async () => {
        toast.success("Indicação removida.");
        await queryClient.invalidateQueries({ queryKey: [["referral"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  return (
    <Card className="flex flex-col gap-4">
      <CardEyebrow>Indicações de {ano}</CardEyebrow>

      {indicacoes.length === 0 ? (
        <EmptyState
          title="Nenhuma indicação ainda"
          description="Quando uma matrícula chegar por um código, ela aparece aqui com o desconto correspondente."
        />
      ) : (
        <Table className="min-w-[40rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Quem indicou</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Registrada em</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicacoes.map((indicacao) => {
              const situacao = SITUACAO[indicacao.situacao];

              return (
                <TableRow key={indicacao.id}>
                  <TableCell className="font-bold">{indicacao.indicanteNome}</TableCell>
                  <TableCell className="font-mono text-meta">{indicacao.codigo}</TableCell>
                  <TableCell>{premio(indicacao.rewardKind, indicacao.rewardValue)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataDoInstante(indicacao.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={situacao.tom}>{situacao.rotulo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover a indicação de ${indicacao.indicanteNome}`}
                      onClick={() => remover.mutate({ id: indicacao.id })}
                      disabled={remover.isPending}
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* A situação não é campo: ela vem da matrícula, sempre. Dizer isso na
          tela evita a pergunta "por que não consigo marcar como confirmada?" */}
      <p className="text-meta text-muted-foreground">
        A situação acompanha a matrícula indicada — confirmar ou cancelar a matrícula muda o
        desconto no mesmo instante. "Acima do limite" é indicação válida que passou do máximo por
        ano configurado no programa.
      </p>
    </Card>
  );
}

/** A tela de quem divulga: o próprio link e o próprio desconto. */
function MeuLink({ ano }: { ano: number }) {
  const trpc = useTRPC();
  const painel = useQuery(trpc.referral.meuPainel.queryOptions({ academicYear: ano }));

  if (painel.isLoading) {
    return (
      <Card>
        <ListSkeleton rows={3} />
      </Card>
    );
  }

  const dados = painel.data;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Conta</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
          {dados?.programa.headline ?? "Indicações"}
        </h1>
        {dados?.programa.description ? (
          <p className="text-corpo text-muted-foreground">{dados.programa.description}</p>
        ) : null}
      </div>

      {!dados || !dados.programa.enabled ? (
        <Card>
          <EmptyState
            title="O programa não está ativo"
            description="Esta escola não tem programa de indicações no ar no momento."
          />
        </Card>
      ) : !dados.aluno ? (
        <Card>
          <EmptyState
            title="Sua conta não está ligada a uma ficha de aluno"
            description="Fale com a secretaria: o link de indicação é emitido para o aluno."
          />
        </Card>
      ) : (
        <CartaoDoLink painel={dados} />
      )}
    </>
  );
}

function CartaoDoLink({ painel }: { painel: MeuPainel }) {
  const { link, programa, indicacoes, resumo } = painel;

  const endereco = link ? `${window.location.origin}/matriculas/nova?indicacao=${link.code}` : null;

  return (
    <>
      {link ? (
        <Card className="flex flex-col gap-4">
          <CardEyebrow>Seu código</CardEyebrow>
          <p className="font-extrabold font-mono text-2xl tracking-[2px]">{link.code}</p>
          <p className="text-corpo text-muted-foreground">
            Vale {premio(programa.rewardKind, programa.rewardValue)}, até{" "}
            {programa.rewardCapPerYear}{" "}
            {programa.rewardCapPerYear === 1 ? "indicação" : "indicações"} por ano.
            {link.expiresAt ? ` O código vale até ${dataDoInstante(link.expiresAt)}.` : ""}
          </p>

          {endereco ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-control bg-muted px-3 py-2.5 text-meta">
                {endereco}
              </code>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(endereco)
                    .then(() => toast.success("Link copiado."))
                    // Sem permissão de área de transferência o link continua
                    // na tela para copiar à mão: a falha não pode virar um
                    // beco sem saída.
                    .catch(() => toast.error("Copie o endereço que está na tela."));
                }}
              >
                <Copy size={18} strokeWidth={1.8} aria-hidden />
                Copiar
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Você ainda não tem código"
            description="Peça na secretaria: o código é emitido por lá, uma vez, e vale para sempre."
          />
        </Card>
      )}

      {resumo ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard icon={Gift} label="Descontos confirmados" tone="success">
            {inteiro(resumo.confirmadas)}
          </StatCard>
          <StatCard icon={Share2} label="Aguardando matrícula" tone="warning">
            {inteiro(resumo.pendentes)}
          </StatCard>
        </div>
      ) : null}

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Suas indicações</CardEyebrow>
        {indicacoes.length === 0 ? (
          <EmptyState
            title="Nenhuma indicação ainda"
            description="Quando alguém se matricular com o seu código, aparece aqui."
          />
        ) : (
          <ul className="flex flex-col">
            {indicacoes.map((indicacao) => {
              const situacao = SITUACAO[indicacao.situacao];
              return (
                <li
                  key={indicacao.id}
                  className="flex flex-wrap items-center gap-3 border-border border-t py-3 text-corpo first:border-t-0"
                >
                  <span className="min-w-36 text-muted-foreground">
                    {dataDoInstante(indicacao.createdAt)}
                  </span>
                  {/* O nome de quem se matriculou **não** aparece: a família
                      que indicou não precisa saber quem entrou por ela, e
                      isso é dado de outra criança. */}
                  <span className="min-w-0 flex-1 font-bold">
                    {premio(indicacao.rewardKind, indicacao.rewardValue)}
                  </span>
                  <Badge variant={situacao.tom}>{situacao.rotulo}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {programa.terms ? (
        <Card className="flex flex-col gap-2">
          <CardEyebrow>Regulamento</CardEyebrow>
          <p className="whitespace-pre-wrap text-corpo text-muted-foreground">{programa.terms}</p>
        </Card>
      ) : null}
    </>
  );
}
