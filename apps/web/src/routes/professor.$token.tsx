import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { Skeleton } from "@educa-escola/ui/components/skeleton";
import { OrbitaMarca } from "@educa-escola/ui/integra/orbita";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/professor/$token")({
  component: ConviteDeProfessor,
});

/**
 * O professor cria a própria senha e entra.
 *
 * **A escola nunca conhece a senha de ninguém.** A secretaria cadastra nome,
 * e-mail e disciplinas, e o que ela entrega é um endereço; quem escolhe a
 * senha é quem vai usá-la. Senha provisória entregue em papel vira senha
 * definitiva, e aí a escola sabe entrar na conta do professor.
 *
 * A autorização aqui é a posse do token — não há conta ainda, e criá-la é
 * justamente o que a pessoa veio fazer.
 */
function ConviteDeProfessor() {
  const { token } = Route.useParams();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");

  const convite = useQuery({ ...trpc.teacher.abrirConvite.queryOptions({ token }), retry: false });

  const aceitar = useMutation(
    trpc.teacher.aceitarConvite.mutationOptions({
      onSuccess: async (saida) => {
        /*
         * Entra na sequência, sem pedir a senha de novo.
         *
         * A pessoa acabou de digitá-la duas vezes; mandá-la à tela de login
         * para digitar uma terceira seria cobrar de novo o que já foi feito.
         */
        await authClient.signIn.email(
          { email: saida.email, password: senha },
          {
            onSuccess: () => navigate({ to: "/inicio" }),
            onError: () => navigate({ to: "/login" }),
          },
        );
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const curta = senha.length > 0 && senha.length < 8;
  const diferentes = repetida.length > 0 && senha !== repetida;
  const pode = senha.length >= 8 && senha === repetida && !aceitar.isPending;

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <OrbitaMarca titulo="Órbita Edu" className="w-36 text-primary" />

        {convite.isLoading ? (
          <Card className="flex w-full flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
        ) : convite.error ? (
          <Card className="flex w-full flex-col items-center gap-3 text-center">
            <TriangleAlert size={26} strokeWidth={1.7} className="text-warning" aria-hidden />
            <p className="font-bold text-corpo">{convite.error.message}</p>
            <p className="text-apoio text-muted-foreground">
              Peça um novo convite à secretaria da escola.
            </p>
          </Card>
        ) : (
          <Card className="flex w-full flex-col gap-5">
            <div>
              <CardEyebrow>{convite.data?.escola}</CardEyebrow>
              <h1 className="font-extrabold text-xl tracking-[-0.4px]">
                Bem-vindo, {convite.data?.nome}
              </h1>
              <p className="mt-2 text-corpo text-muted-foreground">
                Escolha uma senha para entrar. Ela é sua: a escola não vai conhecê-la.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-do-professor">Seu e-mail</Label>
              {/* Só leitura: o e-mail é o que a secretaria cadastrou, e mudá-lo
                  aqui desfaria o vínculo que o convite carrega. */}
              <Input id="email-do-professor" value={convite.data?.email ?? ""} readOnly disabled />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="No mínimo 8 caracteres"
                autoComplete="new-password"
              />
              {curta ? (
                <p className="text-danger text-meta">A senha tem no mínimo 8 caracteres</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repetir-senha">Repita a senha</Label>
              <Input
                id="repetir-senha"
                type="password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                autoComplete="new-password"
              />
              {diferentes ? (
                <p className="text-danger text-meta">As senhas não são iguais</p>
              ) : null}
            </div>

            <Button disabled={!pode} onClick={() => aceitar.mutate({ token, password: senha })}>
              <Check size={18} strokeWidth={2} aria-hidden />
              {aceitar.isPending ? "Criando seu acesso…" : "Criar acesso e entrar"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
