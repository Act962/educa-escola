import { Badge } from "@educa-escola/ui/components/badge";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LogIn, LogOut, ScanFace, Users } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/portaria-do-dia")({
  component: PortariaDoDia,
});

const horaMinuto = (valor: string | Date) =>
  new Date(valor)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");

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
  const situacao = useQuery({
    ...trpc.gate.situacao.queryOptions(),
    // A portaria anda o tempo todo, e quem abre esta tela quer o agora.
    refetchInterval: 30_000,
    retry: false,
  });

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

  const passagens = situacao.data?.passagens ?? [];
  const entradas = passagens.filter((linha) => linha.direction === "entrada");
  const porRosto = passagens.filter((linha) => linha.method === "rosto");

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

      <Card className="gap-4 overflow-x-auto">
        {passagens.length === 0 ? (
          <EmptyState
            title="Ninguém passou ainda hoje"
            description="As passagens aparecem aqui assim que o portão registrar a primeira."
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
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>
              As passagens de hoje, mais recentes primeiro. O contador zera à meia-noite.
            </TableCaption>
          </Table>
        )}
      </Card>
    </div>
  );
}
