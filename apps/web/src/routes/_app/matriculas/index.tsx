import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { SegmentedControl } from "@educa-escola/ui/integra/segmented";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PermissionState,
} from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Plus, Search } from "lucide-react";
import { useState } from "react";
import { EnrollmentsBoard } from "@/components/enrollments-board";
import {
  inteiro,
  parentesco,
  prazo,
  situacaoEnrollment,
  situacaoLink,
  telefoneMascarado,
  turno,
} from "@/lib/format";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/matriculas/")({
  component: Matriculas,
});

const POR_PAGINA = 25;

/** Ano letivo corrente. Enquanto não há gestão de ano, vem do relógio. */
const ANO_LETIVO = new Date().getFullYear();

const FILTROS = [
  { value: "pendente", label: "Pendentes", tone: "warning" as const },
  { value: "ativa", label: "Ativas", tone: "success" as const },
  { value: "cancelada", label: "Canceladas", tone: "neutral" as const },
  { value: "todas", label: "Todas", tone: "neutral" as const },
];

type Filtro = "pendente" | "ativa" | "cancelada" | "todas";

/** `TODOS` em vez de "" porque o Select não aceita valor vazio. */
const TODOS = "TODOS";

/**
 * Lista e quadro mostram os mesmos dados e respeitam os mesmos filtros.
 *
 * Em ícone porque a escolha não é sobre o conteúdo, é sobre como olhar — e
 * porque, em palavras, competia visualmente com "Pendentes · 5" ao lado, que é
 * a escolha que importa nesta tela.
 */
const MODOS = [
  { value: "lista", label: "Ver em lista", tone: "neutral" as const, icon: List },
  { value: "quadro", label: "Ver em quadro", tone: "neutral" as const, icon: LayoutGrid },
];

type Modo = "lista" | "quadro";

const TURNOS = [
  { value: TODOS, label: "Todos os turnos" },
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

/**
 * Fila de matrículas da secretaria.
 *
 * A ordenação é pelo prazo, não pela data de criação: quem vence primeiro
 * aparece primeiro, porque é isso que trava o trabalho de quem está olhando.
 */
function Matriculas() {
  const trpc = useTRPC();
  const [filtro, setFiltro] = useState<Filtro>("pendente");
  const [search, setSearch] = useState("");
  const [turmaId, setTurmaId] = useState(TODOS);
  const [turnoFiltro, setTurnoFiltro] = useState<string>(TODOS);
  const [modo, setModo] = useState<Modo>("lista");
  const [page, setPage] = useState(0);

  const turmas = useQuery(trpc.classroom.list.queryOptions());

  const trocarFiltro = (value: Filtro) => {
    setFiltro(value);
    setPage(0);
  };

  const matriculas = useQuery({
    ...trpc.enrollment.list.queryOptions({
      status: filtro === "todas" ? undefined : filtro,
      search: search.trim() || undefined,
      academicYear: ANO_LETIVO,
      // Os dois recortes do disparo em massa: uma turma, ou um turno inteiro.
      classroomId: turmaId === TODOS ? undefined : turmaId,
      shift: turnoFiltro === TODOS ? undefined : (turnoFiltro as "manha" | "tarde" | "noite"),
      limit: POR_PAGINA,
      offset: page * POR_PAGINA,
    }),
    placeholderData: keepPreviousData,
  });

  const contagens = useQuery(trpc.enrollment.counts.queryOptions({ academicYear: ANO_LETIVO }));

  if (matriculas.error) {
    return (
      <Card>
        {matriculas.error.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não abre esta tela"
            description="Matrículas são da secretaria e da direção. Se você precisa dela, peça a alteração do seu papel."
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar as matrículas"
            description={matriculas.error.message}
            action={
              <Button variant="secondary" onClick={() => matriculas.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        )}
      </Card>
    );
  }

  const itens = matriculas.data?.items ?? [];
  const total = matriculas.data?.total ?? 0;
  const pendentes = contagens.data?.pendente ?? 0;

  // A contagem vai em campo próprio, e não emendada no rótulo: dentro do
  // texto ela quebrava a opção no meio quando faltava largura, e o leitor de
  // tela lia o separador como se fosse parte do nome.
  const opcoes = FILTROS.map((opcao) => ({
    ...opcao,
    count: opcao.value === "todas" ? undefined : (contagens.data?.[opcao.value] ?? 0),
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardEyebrow>Secretaria</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Matrículas</h1>
          <p className="text-corpo text-muted-foreground">
            {pendentes === 0
              ? `Nenhuma pendência no ano letivo de ${ANO_LETIVO}.`
              : `${inteiro(pendentes)} aguardando ação · ano letivo de ${ANO_LETIVO}`}
          </p>
        </div>
        <Button render={<Link to="/matriculas/nova" />}>
          <Plus size={18} strokeWidth={1.7} aria-hidden />
          Nova matrícula
        </Button>
      </div>

      <Card className="flex flex-col gap-4">
        {/*
          Duas linhas, e não quatro controles soltos disputando a mesma.
          Em cima o recorte que define **o que** se está vendo, com o modo de
          visualização encostado na borda oposta; embaixo a busca e os filtros
          que refinam. Antes os quatro tinham o mesmo peso e empilhavam em
          ordem imprevisível conforme a largura.
        */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            label="Situação da matrícula"
            options={opcoes}
            value={filtro}
            onChange={(value) => trocarFiltro(value as Filtro)}
            /* No celular ocupa a linha inteira: dividindo espaço com o par de
               ícones, sobravam 290px e as quatro opções empilhavam numa
               coluna estreita. Com a linha toda elas cabem em 2×2. */
            className="w-full sm:w-auto"
          />
          <SegmentedControl
            label="Modo de visualização"
            options={MODOS}
            value={modo}
            onChange={(value) => setModo(value as Modo)}
            apenasIcone
            /* `ml-auto` porque, empurrado para a própria linha no celular,
               ele fica encostado à direita em vez de solto no meio. */
            className="ml-auto"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* A busca vem primeiro e fica com a sobra de largura: é o que a
              secretaria usa quando já sabe de quem está atrás, e estava no
              fim da fila, atrás de dois filtros que ela usa muito menos. */}
          <div className="relative min-w-48 flex-1">
            <Search
              size={16}
              strokeWidth={1.7}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Buscar por aluno ou matrícula"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </div>

          <Select
            items={[
              { value: TODOS, label: "Todas as turmas" },
              ...(turmas.data ?? [])
                .filter((turma) => turma.academicYear === ANO_LETIVO)
                .map((turma) => ({ value: turma.id, label: turma.name })),
            ]}
            value={turmaId}
            onValueChange={(valor) => {
              setTurmaId(valor ?? TODOS);
              setPage(0);
            }}
          >
            <SelectTrigger aria-label="Turma" className="w-auto min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as turmas</SelectItem>
              {(turmas.data ?? [])
                .filter((turma) => turma.academicYear === ANO_LETIVO)
                .map((turma) => (
                  <SelectItem key={turma.id} value={turma.id}>
                    {turma.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            items={TURNOS.map((o) => ({ value: o.value, label: o.label }))}
            value={turnoFiltro}
            onValueChange={(valor) => {
              setTurnoFiltro(valor ?? TODOS);
              setPage(0);
            }}
          >
            <SelectTrigger aria-label="Turno" className="w-auto min-w-36">
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

        {modo === "quadro" ? (
          <EnrollmentsBoard
            filtros={{
              academicYear: ANO_LETIVO,
              search: search.trim() || undefined,
              classroomId: turmaId === TODOS ? undefined : turmaId,
              shift:
                turnoFiltro === TODOS ? undefined : (turnoFiltro as "manha" | "tarde" | "noite"),
            }}
          />
        ) : matriculas.isLoading ? (
          <ListSkeleton rows={6} />
        ) : itens.length === 0 ? (
          <EmptyState
            title="Nenhuma matrícula aqui"
            description={
              search
                ? "Nenhum resultado para esta busca. Tente outro nome ou número de matrícula."
                : `Nada nesta situação no ano letivo de ${ANO_LETIVO}. Quando houver, aparece nesta lista.`
            }
            action={
              search ? undefined : (
                <Button render={<Link to="/matriculas/nova" />}>Nova matrícula</Button>
              )
            }
          />
        ) : (
          <>
            <Table className="min-w-[62rem]">
              <TableCaption>
                O código é série e turno — `6M` é 6º ano da manhã. Ele é calculado a partir da
                turma, então acompanha o aluno quando ela muda. O telefone aparece parcial: a ficha
                completa está no detalhe.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => {
                  const situacao = situacaoEnrollment(item.status);
                  const link = situacaoLink(item.linkStatus);
                  const restante = prazo(item.expiresAt);
                  const urgente =
                    item.status === "pendente" &&
                    (restante === "vence hoje" || restante === "vencido");

                  return (
                    <TableRow key={item.id} className={urgente ? "bg-danger-soft" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{initialsOf(item.studentName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-bold text-sm">{item.studentName}</div>
                            <div className="text-meta text-muted-foreground">
                              {item.registration}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-corpo">{item.classroomName ?? "A definir"}</div>
                        <div className="text-meta text-muted-foreground">{turno(item.shift)}</div>
                      </TableCell>
                      <TableCell>
                        {item.classCode ? (
                          <Badge variant="neutral" title={item.classLabel}>
                            {item.classCode}
                          </Badge>
                        ) : (
                          <span className="text-meta text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-corpo">{item.guardianName ?? "—"}</div>
                        <div className="text-meta text-muted-foreground">
                          {item.guardianRelationship ? parentesco(item.guardianRelationship) : "—"}
                          {" · "}
                          {telefoneMascarado(item.guardianPhone)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={link.tone}>{link.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={situacao.tone}>{situacao.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            urgente
                              ? "font-bold text-corpo text-danger"
                              : "text-corpo text-muted-foreground"
                          }
                        >
                          {item.status === "pendente" ? restante : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          render={
                            <Link
                              to="/matriculas/$enrollmentId"
                              params={{ enrollmentId: item.id }}
                            />
                          }
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between gap-4">
              <span className="text-meta text-muted-foreground">
                {page * POR_PAGINA + 1}–{Math.min((page + 1) * POR_PAGINA, total)} de{" "}
                {inteiro(total)} matrículas
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((atual) => atual - 1)}
                >
                  <ChevronLeft size={16} strokeWidth={1.7} aria-hidden />
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(page + 1) * POR_PAGINA >= total}
                  onClick={() => setPage((atual) => atual + 1)}
                >
                  Próxima
                  <ChevronRight size={16} strokeWidth={1.7} aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
