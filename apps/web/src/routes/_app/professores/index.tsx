import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Search, TriangleAlert, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/professores/")({
  component: Professores,
});

/**
 * Rótulo e tom de cada situação.
 *
 * **O tom vem da pendência, nunca da pessoa.** "Sem turma" é `info` e não
 * `danger`: não ter aula alocada não é falha do docente, é a grade que não
 * foi montada — e pintar de vermelho faria a direção cobrar a pessoa errada.
 */
const SITUACOES = {
  em_dia: { rotulo: "Em dia", variante: "success" },
  atencao: { rotulo: "Atenção", variante: "warning" },
  atrasado: { rotulo: "Atrasado", variante: "danger" },
  sem_turma: { rotulo: "Sem turma", variante: "info" },
} as const;

/**
 * O corpo docente, para a direção.
 *
 * Mostra o que cada professor está devendo em registro — chamada e nota — e
 * nada sobre desempenho. Média da turma e taxa de aprovação ficam de fora de
 * propósito: §10.6 do requisito diz que indicador pedagógico é apoio, não
 * ranking de docentes, e uma tela de gestão de pessoal é justamente onde esse
 * limite seria atravessado sem querer.
 */
function Professores() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();
  const [busca, setBusca] = useState("");
  const [soPendencias, setSoPendencias] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const me = useQuery(trpc.me.queryOptions());
  /* Mesmo padrão do resto: quem não tem `faculty: ["manage"]` esbarraria num
     403 depois de preencher o formulário inteiro. */
  const podeCadastrar = me.data?.role === "owner" || me.data?.role === "admin";

  const docentes = useQuery({
    ...trpc.teacher.list.queryOptions({
      academicYear: year,
      search: busca.trim() || undefined,
      comPendencia: soPendencias || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const resumo = docentes.data?.resumo;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Professores</h1>
        <p className="text-corpo text-muted-foreground">
          Quem leciona em {year}, com o que está pendente de registro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard icon={Users} label="No corpo docente" hint={`vínculo ativo em ${year}`}>
          {resumo ? inteiro(resumo.total) : "—"}
        </StatCard>
        <StatCard
          icon={TriangleAlert}
          label="Com pendência"
          hint="chamada ou nota em aberto"
          tone={resumo && resumo.comPendencia > 0 ? "warning" : undefined}
        >
          {resumo ? inteiro(resumo.comPendencia) : "—"}
        </StatCard>
        <StatCard icon={ClipboardList} label="Chamadas em aberto" hint="aulas já encerradas">
          {resumo ? inteiro(resumo.chamadasPendentes) : "—"}
        </StatCard>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="pl-9"
              aria-label="Buscar professor"
            />
          </div>
          {/* Mesmo padrão do "Alerta de frequência" da lista de alunos:
              botão com `aria-pressed`, e não um toggle — o design system não
              tem esse primitivo, e inventar um aqui abriria duas linguagens
              para o mesmo gesto. */}
          <Button
            variant={soPendencias ? "warning" : "secondary"}
            aria-pressed={soPendencias}
            onClick={() => setSoPendencias((atual) => !atual)}
          >
            Só com pendência
          </Button>
          {podeCadastrar ? (
            <Button className="ml-auto" onClick={() => setCadastrando(true)}>
              <UserPlus size={18} strokeWidth={1.8} aria-hidden />
              Novo professor
            </Button>
          ) : null}
        </div>

        {cadastrando ? <NovoProfessor onFechar={() => setCadastrando(false)} /> : null}

        {docentes.isLoading ? (
          <ListSkeleton rows={6} />
        ) : docentes.isError ? (
          <ErrorState
            title="Não foi possível carregar o corpo docente"
            description="Atualize a página em instantes."
          />
        ) : docentes.data?.items.length === 0 ? (
          <EmptyState
            title={soPendencias ? "Ninguém com pendência" : "Nenhum professor encontrado"}
            description={
              soPendencias
                ? "Todas as chamadas e notas do ano estão registradas."
                : "Ajuste a busca, ou vincule professores à escola."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead>Turmas</TableHead>
                <TableHead>Disciplinas</TableHead>
                <TableHead>Aulas</TableHead>
                <TableHead>Pendências</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docentes.data?.items.map((docente) => {
                const situacao = SITUACOES[docente.situacao];
                const pendencias = docente.chamadasPendentes + docente.notasPendentes;

                return (
                  <TableRow key={docente.userId}>
                    <TableCell>
                      <Link
                        to="/professores/$userId"
                        params={{ userId: docente.userId }}
                        className="flex items-center gap-3"
                      >
                        <Avatar>
                          <AvatarFallback>{initialsOf(docente.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{docente.name}</p>
                          <p className="truncate text-meta text-muted-foreground">
                            {docente.email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{inteiro(docente.turmas)}</TableCell>
                    <TableCell>{inteiro(docente.disciplinas)}</TableCell>
                    <TableCell>{inteiro(docente.aulas)}</TableCell>
                    <TableCell>
                      {pendencias === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        // Chamada e nota separadas: são cobranças diferentes,
                        // e um número só não diz à coordenação o que pedir.
                        <span className="text-meta">
                          {docente.chamadasPendentes > 0
                            ? `${inteiro(docente.chamadasPendentes)} chamada${docente.chamadasPendentes > 1 ? "s" : ""}`
                            : null}
                          {docente.chamadasPendentes > 0 && docente.notasPendentes > 0 ? " · " : ""}
                          {docente.notasPendentes > 0
                            ? `${inteiro(docente.notasPendentes)} nota${docente.notasPendentes > 1 ? "s" : ""}`
                            : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="text-meta text-muted-foreground">
        A lista é ordenada por nome, nunca por pendência: uma lista que se reordena conforme alguém
        atrasa vira ranking de docentes por acidente. Tudo aqui é sobre registro — nada sobre nota
        da turma ou taxa de aprovação.
      </p>
    </>
  );
}

/**
 * O cadastro de professor.
 *
 * O que sai daqui é um **link**, não uma senha: a escola nunca conhece a senha
 * de ninguém. O endereço aparece uma vez e é copiado — mesma costura do link
 * de matrícula, enquanto o envio automático não existe.
 */
function NovoProfessor({ onFechar }: { onFechar: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);

  const catalogo = useQuery({ ...trpc.teacher.disciplinas.queryOptions(), retry: false });

  const convidar = useMutation(
    trpc.teacher.convidar.mutationOptions({
      onSuccess: (saida) => {
        setLink(saida.url);
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (link) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-info-soft p-4">
        <p className="font-bold text-corpo">Mande este endereço ao professor</p>
        <p className="break-all font-mono text-meta">{link}</p>
        <p className="text-meta text-muted-foreground">
          Ele aparece só agora e vale 7 dias. Quem escolhe a senha é o professor — a escola não
          conhece a senha de ninguém.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Endereço copiado.");
            }}
          >
            Copiar endereço
          </Button>
          <Button size="sm" variant="ghost" onClick={onFechar}>
            Concluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-card bg-muted p-4">
      <p className="font-bold text-corpo">Novo professor</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome-do-professor">Nome completo</Label>
          <Input
            id="nome-do-professor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como aparece no diário"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-do-professor">E-mail</Label>
          <Input
            id="email-do-professor"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="professor@escola.br"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-bold text-apoio">Disciplinas que ele pode lecionar</span>
        {/*
          Habilitação, não alocação: isto é o que ele **pode** dar, e serve
          para a coordenação montar a grade oferecendo só quem dá a matéria. O
          que ele leciona de fato continua saindo das aulas.
        */}
        <p className="text-meta text-muted-foreground">
          Opcional. Serve para a coordenação saber quem pode pegar cada turma.
        </p>
        <div className="flex flex-wrap gap-2">
          {(catalogo.data ?? []).map((disciplina) => {
            const marcada = disciplinas.includes(disciplina.id);
            return (
              <Button
                key={disciplina.id}
                size="sm"
                variant={marcada ? "default" : "secondary"}
                aria-pressed={marcada}
                className="min-h-8 px-3 text-meta"
                onClick={() =>
                  setDisciplinas((atuais) =>
                    marcada
                      ? atuais.filter((id) => id !== disciplina.id)
                      : [...atuais, disciplina.id],
                  )
                }
              >
                {disciplina.name}
              </Button>
            );
          })}
          {catalogo.data?.length === 0 ? (
            <p className="text-meta text-muted-foreground">
              A escola ainda não tem disciplinas cadastradas. Elas ficam em Acadêmico.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={nome.trim().length < 3 || !email.includes("@") || convidar.isPending}
          onClick={() =>
            convidar.mutate({ name: nome, email, subjectIds: disciplinas, expiryDays: 7 })
          }
        >
          {convidar.isPending ? "Gerando link…" : "Gerar link de acesso"}
        </Button>
        <Button variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
