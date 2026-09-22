import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, IdCard, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { SegurancaDaConta } from "@/components/seguranca-da-conta";
import { authClient } from "@/lib/auth-client";
import { dataDoInstante, inteiro, situacaoMatricula, turno } from "@/lib/format";
import { roleLabel } from "@/lib/navigation";
import { useSchoolContext } from "@/lib/school-context";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/perfil")({
  component: MeuPerfil,
});

/**
 * "Meu perfil": a conta, o vínculo com a escola e a segurança do acesso.
 *
 * Existe para os três perfis, sem recorte de papel: não há dado de outra
 * pessoa nesta tela, então não há o que esconder de ninguém. O que muda é o
 * cartão do vínculo — matrícula e turma para o aluno, carga para quem dá aula.
 *
 * **Só o nome é editável.** E-mail e papel são o vínculo, e quem os altera é a
 * secretaria: deixar a própria pessoa trocar o papel seria escalada de
 * privilégio pela tela mais inocente do sistema.
 */
function MeuPerfil() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();
  const perfil = useQuery(trpc.profile.me.queryOptions({ academicYear: year }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Conta</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Meu perfil</h1>
        <p className="text-[13px] text-muted-foreground">
          Seus dados, seu vínculo com a escola e a segurança do seu acesso.
        </p>
      </div>

      {perfil.isLoading ? (
        <Card>
          <ListSkeleton rows={4} />
        </Card>
      ) : perfil.isError || !perfil.data ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar seu perfil"
            description={perfil.error?.message ?? "Atualize a página em instantes."}
          />
        </Card>
      ) : (
        <>
          <Identificacao perfil={perfil.data} />
          <MeuVinculo perfil={perfil.data} />
          <SegurancaDaConta />
        </>
      )}
    </>
  );
}

/**
 * A forma vem do router, não de uma cópia local: quando `profile.me` mudar, a
 * tela quebra na compilação em vez de mentir em silêncio.
 */
type PerfilCarregado = RouterOutputs["profile"]["me"];

function Identificacao({ perfil }: { perfil: PerfilCarregado }) {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { name: perfil.name },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(3, "O nome precisa de ao menos 3 caracteres")
          .max(120, "O nome passou de 120 caracteres"),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      /**
       * O nome mora na tabela `user`, que é do Better Auth — por isso a
       * escrita vai por `authClient` e não por tRPC. A decisão estrutural nº 2
       * é essa: a auth é dona da identidade, o domínio é dono da escola.
       */
      const { error } = await authClient.updateUser({ name: value.name.trim() });

      if (error) {
        toast.error(error.message ?? "Não foi possível salvar o nome.");
        return;
      }

      toast.success("Nome atualizado.");
      // Sem o `reset`, o formulário continuaria "sujo" depois de salvar: o
      // botão "Desfazer" ficaria na tela oferecendo desfazer o que já é o
      // valor gravado.
      formApi.reset({ name: value.name.trim() });
      // `me` decide o menu e a saudação do painel; sem invalidar, a tela
      // continuaria chamando a pessoa pelo nome antigo até o cache expirar.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [["profile"]] }),
        queryClient.invalidateQueries({ queryKey: [["me"]] }),
      ]);
    },
  });

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback>{initialsOf(perfil.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-extrabold text-lg tracking-[-0.3px]">{perfil.name}</p>
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <Badge variant="info">{roleLabel(perfil.role)}</Badge>
            <span className="truncate">{perfil.schoolName}</span>
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
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Nome completo</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(evento) => field.handleChange(evento.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                É como você aparece na chamada, no diário e nos comunicados.
              </p>
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-[11px] text-danger">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFixo
            rotulo="E-mail de acesso"
            valor={perfil.email}
            nota="Trocar o e-mail muda o login: quem faz isso é a secretaria."
          />
          <CampoFixo
            rotulo="Papel nesta escola"
            valor={roleLabel(perfil.role)}
            nota="Definido pelo vínculo. Não se altera por esta tela."
          />
          <CampoFixo rotulo="Na escola desde" valor={dataDoInstante(perfil.naEscolaDesde)} />
          <CampoFixo rotulo="Conta criada em" valor={dataDoInstante(perfil.contaCriadaEm)} />
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
                {enviando ? "Salvando…" : "Salvar nome"}
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
 * Campo que a pessoa lê e não edita.
 *
 * Não é `<Input disabled>` de propósito: campo desabilitado parece um campo
 * que está quebrado, e a pessoa fica clicando nele. Aqui é texto, com a razão
 * de ser fixo logo abaixo.
 */
function CampoFixo({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-control bg-muted px-4 py-3">
      <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]">
        {rotulo}
      </span>
      <span className="truncate font-bold text-[13px]">{valor}</span>
      {nota ? <span className="text-[11px] text-muted-foreground">{nota}</span> : null}
    </div>
  );
}

function MeuVinculo({ perfil }: { perfil: PerfilCarregado }) {
  const { year } = useSchoolContext();
  const vinculo = perfil.vinculo;

  if (vinculo.tipo === "gestao") {
    return (
      <Card className="flex flex-col gap-3">
        <CardEyebrow>Vínculo</CardEyebrow>
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">
          Você responde por {perfil.schoolName}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {perfil.role === "owner"
            ? "Como direção, você enxerga a escola inteira e é quem assina o que gera custo."
            : "Como secretaria, você opera a escola inteira — menos o que só a direção assina."}
        </p>
        <Button
          variant="secondary"
          className="self-start"
          nativeButton={false}
          render={<Link to="/configuracoes" />}
        >
          Abrir as configurações da escola
        </Button>
      </Card>
    );
  }

  if (vinculo.tipo === "professor") {
    return (
      <Card className="flex flex-col gap-4">
        <CardEyebrow>Vínculo</CardEyebrow>
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">Sua carga em {year}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={LayoutGrid} label="Turmas" hint="com aula na grade">
            {inteiro(vinculo.turmas)}
          </StatCard>
          <StatCard icon={BookOpen} label="Disciplinas" hint="que você leciona">
            {inteiro(vinculo.disciplinas)}
          </StatCard>
          <StatCard icon={CalendarDays} label="Aulas no ano" hint="previstas na grade">
            {inteiro(vinculo.aulas)}
          </StatCard>
        </div>
        {/* Zero não é erro: professor recém-vinculado ainda não entrou na
            grade, e a tela precisa dizer isso em vez de parecer quebrada. */}
        {vinculo.aulas === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Você ainda não tem aula na grade de {year}. Quem monta a grade é a coordenação.
          </p>
        ) : null}
      </Card>
    );
  }

  const situacao = vinculo.situacao ? situacaoMatricula(vinculo.situacao) : null;

  return (
    <Card className="flex flex-col gap-4">
      <CardEyebrow>Vínculo</CardEyebrow>
      <h2 className="font-extrabold text-lg tracking-[-0.3px]">Sua matrícula</h2>

      {vinculo.matricula === null ? (
        <p className="text-[13px] text-muted-foreground">
          Sua conta ainda não está ligada a uma ficha de aluno. Fale com a secretaria — o acesso
          funciona, mas turma e boletim só aparecem depois dessa ligação.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFixo rotulo="Número de matrícula" valor={vinculo.matricula} />
            <CampoFixo rotulo="Turma" valor={vinculo.turma ?? "Ainda sem turma"} />
            <CampoFixo rotulo="Turno" valor={vinculo.turno ? turno(vinculo.turno) : "—"} />
            <div className="flex flex-col gap-1 rounded-control bg-muted px-4 py-3">
              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.7px]">
                Situação
              </span>
              {situacao ? (
                <Badge variant={situacao.tone} className="self-start">
                  {situacao.label}
                </Badge>
              ) : (
                <span className="font-bold text-[13px]">—</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" nativeButton={false} render={<Link to="/boletim" />}>
              <BookOpen strokeWidth={1.7} aria-hidden />
              Meu boletim
            </Button>
            <Button variant="secondary" nativeButton={false} render={<Link to="/frequencia" />}>
              <IdCard strokeWidth={1.7} aria-hidden />
              Minha frequência
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
