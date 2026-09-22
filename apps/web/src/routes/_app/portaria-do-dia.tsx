import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
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
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LogIn, LogOut, ScanFace, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CampoDeData } from "@/components/campo-de-data";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/portaria-do-dia")({
  component: PortariaDoDia,
});

const horaMinuto = (valor: string | Date) =>
  new Date(valor)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");

const diaDeHoje = () => {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
};

const dataHora = (valor: string | Date) =>
  new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const COMO_ENTROU: Record<string, string> = {
  rosto: "Rosto",
  carteirinha: "Carteirinha",
  manual: "Pela secretaria",
};

/**
 * Quem passou no portão hoje, e a que horas.
 *
 * **Isto não é frequência.** A lista diz que o aluno cruzou o portão; quem
 * marca presença continua sendo o professor, olhando a sala. Entrar na escola
 * não é estar na aula — e é por isso que esta tela vive longe da chamada, com
 * nome próprio.
 *
 * O método aparece em cada linha porque as três formas têm confiabilidade
 * diferente: `Pela secretaria` é alguém afirmando que o aluno passou, e uma
 * conferência precisa distinguir isso de uma leitura de equipamento.
 */
function PortariaDoDia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [dia, setDia] = useState(diaDeHoje);
  const [aluno, setAluno] = useState<string>("todos");
  const [aba, setAba] = useState<"movimento" | "excluidas">("movimento");

  const situacao = useQuery({
    ...trpc.gate.situacao.queryOptions(),
    // A portaria anda o tempo todo, e quem abre esta tela quer o agora.
    refetchInterval: 30_000,
    retry: false,
  });

  const lista = useQuery({
    ...trpc.gate.passagens.queryOptions({
      dia,
      studentId: aluno === "todos" ? undefined : aluno,
      excluidas: aba === "excluidas",
    }),
    retry: false,
  });

  const excluir = useMutation(
    trpc.gate.excluirPassagem.mutationOptions({
      onSuccess: () => {
        toast.success("Passagem excluída. Ela continua na aba Excluídas.");
        queryClient.invalidateQueries({ queryKey: [["gate"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (situacao.isLoading) return <ListSkeleton />;

  if (situacao.error) {
    return (
      <Card>
        <PermissionState
          title="Sem acesso à portaria"
          description="Quem vê as passagens é a direção, a secretaria e o professor."
        />
      </Card>
    );
  }

  const passagens = lista.data ?? [];
  const doDia = situacao.data?.passagens ?? [];
  const entradas = doDia.filter((linha) => linha.direction === "entrada");
  const porRosto = doDia.filter((linha) => linha.method === "rosto");

  /*
   * A lista de alunos sai do próprio dia, e não do cadastro inteiro: quem
   * abre esta tela procura alguém que passou, e uma lista com setecentos nomes
   * para escolher entre os dez que apareceram é a pior forma de filtrar.
   */
  const alunosDoDia = [...new Map(doDia.map((l) => [l.studentId, l.name])).entries()].sort((a, b) =>
    (a[1] ?? "").localeCompare(b[1] ?? ""),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <CardEyebrow>Portaria</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Quem passou hoje</h1>
        <p className="text-corpo text-muted-foreground">
          Entradas e saídas do portão, com horário. Não é chamada: quem marca presença é o
          professor.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Na escola agora" hint="última passagem foi entrada">
          {situacao.data?.dentro ?? 0}
        </StatCard>
        <StatCard icon={LogIn} label="Entradas hoje" hint="contando cada passagem">
          {entradas.length}
        </StatCard>
        <StatCard icon={ScanFace} label="Pelo rosto" hint="as demais, pela carteirinha">
          {porRosto.length}
        </StatCard>
      </div>

      <Card className="gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <CampoDeData
            id="dia-da-portaria"
            label="Dia"
            value={dia}
            onChange={(iso) => iso && setDia(iso)}
            max={diaDeHoje()}
          />

          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <span className="font-bold text-apoio">Aluno</span>
            <Select value={aluno} onValueChange={(valor) => setAluno(valor ?? "todos")}>
              <SelectTrigger id="aluno-da-portaria">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {alunosDoDia.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SegmentedControl
            label="O que mostrar"
            value={aba}
            onChange={setAba}
            options={[
              { value: "movimento", label: "Movimento", tone: "info" },
              { value: "excluidas", label: "Excluídas", tone: "warning" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          {lista.isLoading ? (
            <ListSkeleton />
          ) : passagens.length === 0 ? (
            <EmptyState
              title={aba === "excluidas" ? "Nenhuma passagem excluída" : "Ninguém passou neste dia"}
              description={
                aba === "excluidas"
                  ? "O que for excluído no movimento aparece aqui, com quem excluiu e quando."
                  : "As passagens aparecem assim que o portão registrar a primeira."
              }
            />
          ) : (
            <Table className="min-w-[38rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Movimento</TableHead>
                  <TableHead>Como</TableHead>
                  <TableHead className="text-right">Horário</TableHead>
                  {aba === "excluidas" ? (
                    <TableHead>Excluída por</TableHead>
                  ) : (
                    <TableHead className="text-right">Ação</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {passagens.map((linha) => (
                  <TableRow key={linha.id}>
                    <TableCell className="font-extrabold">{linha.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {linha.classroomName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={linha.direction === "entrada" ? "success" : "neutral"}>
                        {linha.direction === "entrada" ? (
                          <LogIn size={13} strokeWidth={2} aria-hidden />
                        ) : (
                          <LogOut size={13} strokeWidth={2} aria-hidden />
                        )}
                        {linha.direction === "entrada" ? "Entrou" : "Saiu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {COMO_ENTROU[linha.method] ?? linha.method}
                    </TableCell>
                    <TableCell className="text-right font-extrabold tabular-nums">
                      {horaMinuto(linha.occurredAt)}
                    </TableCell>
                    {aba === "excluidas" ? (
                      <TableCell className="text-muted-foreground">
                        {/* Quem e quando: é para isso que a aba existe. */}
                        {linha.deletedByName ?? "—"}
                        {linha.deletedAt ? (
                          <span className="block text-meta tabular-nums">
                            {dataHora(linha.deletedAt)}
                          </span>
                        ) : null}
                      </TableCell>
                    ) : (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2 text-danger text-meta"
                          disabled={excluir.isPending}
                          onClick={() => excluir.mutate({ id: linha.id })}
                        >
                          <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                          Excluir
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>
                {aba === "excluidas"
                  ? "Excluir não apaga: a passagem sai do movimento e fica aqui, com autor e instante."
                  : "As passagens do dia, mais recentes primeiro."}
              </TableCaption>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
