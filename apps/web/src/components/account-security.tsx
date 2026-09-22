import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { dispositivoDe } from "@/lib/device";
import { dataHora } from "@/lib/format";

/** Mesmo piso do login: o servidor recusa menos que isso de qualquer forma. */
const MINIMO_DA_SENHA = 8;

const SESSOES = ["sessoes-ativas"];

/**
 * Traduz o que o Better Auth devolve em inglês.
 *
 * Só as mensagens que a pessoa vê com frequência. O resto passa direto, e
 * texto em inglês numa tela em português é feio — mas inventar uma tradução
 * genérica ("algo deu errado") esconderia o motivo real, que é pior.
 */
function emPortugues(mensagem: string | undefined): string {
  if (!mensagem) return "Não foi possível concluir.";
  if (/invalid password/i.test(mensagem)) return "A senha atual está incorreta.";
  if (/password too short/i.test(mensagem))
    return `A nova senha precisa de ao menos ${MINIMO_DA_SENHA} caracteres.`;
  if (/too many requests/i.test(mensagem))
    return "Muitas tentativas seguidas. Espere alguns instantes.";
  return mensagem;
}

/**
 * Troca de senha e sessões ativas.
 *
 * **Nada aqui passa por tRPC.** Senha e sessão são do Better Auth: ele tem o
 * hash, o limite de tentativas por endpoint e a invalidação do cookie. Uma
 * procedure nossa no meio só acrescentaria um lugar por onde a senha viaja.
 */
export function AccountSecurity() {
  return (
    <>
      <TrocarSenha />
      <SessoesAtivas />
    </>
  );
}

function TrocarSenha() {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { atual: "", nova: "", confirmacao: "", encerrarOutras: true },
    validators: {
      onSubmit: z
        .object({
          atual: z.string().min(1, "Informe a senha atual"),
          nova: z
            .string()
            .min(MINIMO_DA_SENHA, `A nova senha tem no mínimo ${MINIMO_DA_SENHA} caracteres`),
          confirmacao: z.string(),
          encerrarOutras: z.boolean(),
        })
        // A confirmação é validada aqui, e não no campo, porque depende de
        // outro campo: no `onChange` do campo ela erraria enquanto a pessoa
        // ainda está digitando a primeira letra.
        .refine((v) => v.nova === v.confirmacao, {
          message: "A confirmação não bate com a nova senha",
          path: ["confirmacao"],
        })
        .refine((v) => v.nova !== v.atual, {
          message: "A nova senha precisa ser diferente da atual",
          path: ["nova"],
        }),
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.atual,
        newPassword: value.nova,
        revokeOtherSessions: value.encerrarOutras,
      });

      if (error) {
        toast.error(emPortugues(error.message));
        return;
      }

      toast.success(
        value.encerrarOutras
          ? "Senha alterada. As outras sessões foram encerradas."
          : "Senha alterada.",
      );
      formApi.reset();
      await queryClient.invalidateQueries({ queryKey: SESSOES });
    },
  });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <KeyRound size={18} strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
        <CardEyebrow>Segurança</CardEyebrow>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">Trocar a senha</h2>
        <p className="text-corpo text-muted-foreground">
          Precisa da senha atual. Se você não a tem, a secretaria redefine o acesso.
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
        {/* Campo escondido com o e-mail: sem ele o gerenciador de senhas do
            navegador salva a nova senha sem saber de qual conta é. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly value="" />

        <form.Field name="atual">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Senha atual</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(evento) => field.handleChange(evento.target.value)}
              />
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="nova">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Nova senha</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(evento) => field.handleChange(evento.target.value)}
                />
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="confirmacao">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Repita a nova senha</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(evento) => field.handleChange(evento.target.value)}
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

        <form.Field name="encerrarOutras">
          {(field) => (
            <label className="flex items-start gap-2.5 text-corpo">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={field.state.value}
                onChange={(evento) => field.handleChange(evento.target.checked)}
              />
              {/*
                Marcado por padrão. Quem troca a senha quase sempre troca
                porque desconfia de alguém — deixar as outras sessões abertas
                faz a troca não resolver nada.
              */}
              <span>
                Encerrar as outras sessões
                <span className="block text-meta text-muted-foreground">
                  Quem estiver logado em outro aparelho precisará entrar de novo.
                </span>
              </span>
            </label>
          )}
        </form.Field>

        <form.Subscribe
          selector={(estado) => ({
            podeEnviar: estado.canSubmit,
            enviando: estado.isSubmitting,
          })}
        >
          {({ podeEnviar, enviando }) => (
            <Button type="submit" className="self-start" disabled={!podeEnviar || enviando}>
              {enviando ? "Salvando…" : "Trocar a senha"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}

function SessoesAtivas() {
  const queryClient = useQueryClient();
  const sessaoAtual = authClient.useSession();

  const sessoes = useQuery({
    queryKey: SESSOES,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message ?? "Não foi possível listar as sessões.");
      return data ?? [];
    },
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: SESSOES });

  const encerrar = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(emPortugues(error.message));
    },
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      return invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const encerrarOutras = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(emPortugues(error.message));
    },
    onSuccess: () => {
      toast.success("As outras sessões foram encerradas.");
      return invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const tokenAtual = sessaoAtual.data?.session.token;
  const lista = sessoes.data ?? [];
  const outras = lista.filter((sessao) => sessao.token !== tokenAtual).length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MonitorSmartphone
          size={18}
          strokeWidth={1.7}
          aria-hidden
          className="text-muted-foreground"
        />
        <CardEyebrow>Segurança</CardEyebrow>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-extrabold text-lg tracking-[-0.3px]">Sessões ativas</h2>
        <p className="text-corpo text-muted-foreground">
          Onde a sua conta está aberta agora. Não reconhece alguma? Encerre e troque a senha.
        </p>
      </div>

      {sessoes.isLoading ? (
        <ListSkeleton rows={3} />
      ) : sessoes.isError ? (
        <ErrorState
          title="Não foi possível listar as sessões"
          description="Atualize a página em instantes."
        />
      ) : lista.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão listada"
          description="Isso não deveria acontecer: você está usando uma agora."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((sessao) => {
            const ehAtual = sessao.token === tokenAtual;

            return (
              <li
                key={sessao.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-muted px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold text-corpo">
                    {dispositivoDe(sessao.userAgent)}
                    {ehAtual ? <Badge variant="success">Este aparelho</Badge> : null}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    {/* IP inteiro, e não mascarado: é a própria pessoa lendo o
                        próprio acesso, e meio endereço não reconhece nada. */}
                    {sessao.ipAddress ? `${sessao.ipAddress} · ` : ""}
                    entrou em {dataHora(sessao.createdAt)} · expira em {dataHora(sessao.expiresAt)}
                  </p>
                </div>

                {/*
                  A sessão atual não tem botão de encerrar: seria um "Sair"
                  disfarçado, no lugar errado da tela. Sair continua no rodapé
                  da barra lateral, que é onde a pessoa procura.
                */}
                {ehAtual ? (
                  <span className="text-meta text-muted-foreground">em uso</span>
                ) : (
                  <Button
                    // `outline` e não `secondary`: a linha já é `bg-muted`, e
                    // o botão secundário some dentro dela.
                    variant="outline"
                    size="sm"
                    onClick={() => encerrar.mutate(sessao.token)}
                    disabled={encerrar.isPending}
                  >
                    Encerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {outras > 0 ? (
        <Alert variant="warning">
          <AlertTitle>
            {outras === 1 ? "Há outra sessão aberta" : `Há outras ${outras} sessões abertas`}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Encerrar todas mantém só este aparelho conectado.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => encerrarOutras.mutate()}
              disabled={encerrarOutras.isPending}
            >
              Encerrar as outras
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}
