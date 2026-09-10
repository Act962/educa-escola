import { Button } from "@educa-escola/ui/components/button";
import { Card } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: Login,
});

/**
 * Entrada única para os três perfis.
 *
 * Não existe auto-cadastro: escola e vínculo são provisionados pela plataforma
 * (`allowUserToCreateOrganization` está desligado), então uma tela de "criar
 * conta" prometeria algo que o servidor recusa.
 */
function Login() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onSubmit: z.object({
        email: z.email("Informe um e-mail válido"),
        password: z.string().min(8, "A senha tem no mínimo 8 caracteres"),
      }),
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => navigate({ to: "/inicio" }),
          onError: (error) => {
            toast.error(
              error.error.message === "Invalid email or password"
                ? "E-mail ou senha incorretos."
                : (error.error.message ?? "Não foi possível entrar."),
            );
          },
        },
      );
    },
  });

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 text-center">
          <GraduationCap size={34} strokeWidth={1.7} className="text-primary" aria-hidden />
          <span className="font-extrabold text-xl tracking-[-0.4px]">
            Integra<span className="text-primary">Edu</span>
          </span>
          <p className="text-[13px] text-muted-foreground">
            Entre com o acesso fornecido pela sua escola.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="email">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>E-mail</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-[11px] text-danger">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Senha</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-[11px] text-danger">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Entrando…" : "Entrar"}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <p className="text-center text-[11px] text-muted-foreground">
          Não há auto-cadastro: o acesso é criado pela secretaria da instituição.
        </p>
      </Card>
    </div>
  );
}
