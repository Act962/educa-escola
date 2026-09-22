import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { OrbitaAstro } from "@educa-escola/ui/integra/orbita";
import { ListSkeleton } from "@educa-escola/ui/integra/states";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { useTRPC } from "@/utils/trpc";

/**
 * A configuração do Astro, dentro de Configurações.
 *
 * O campo da credencial é **de escrita, nunca de leitura**: ele nasce vazio
 * mesmo quando há chave gravada, e salvar sem tocar nele mantém a que está lá.
 * O que a tela mostra é a dica — os quatro últimos caracteres — para a direção
 * reconhecer qual chave está no ar sem que ela volte do servidor.
 */
export function ConfiguracaoDoAstro() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const config = useQuery({ ...trpc.assistant.configuracao.queryOptions(), retry: false });

  const salvar = useMutation(
    trpc.assistant.salvar.mutationOptions({
      onSuccess: async () => {
        toast.success("Astro atualizado.");
        await queryClient.invalidateQueries({ queryKey: [["assistant"]] });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (config.isLoading) {
    return (
      <Card>
        <ListSkeleton rows={4} />
      </Card>
    );
  }

  // Quem não tem `assistant: manage` recebe 403; é resposta esperada, e o
  // card some em vez de mostrar erro numa tela que a pessoa pode abrir.
  if (config.isError || !config.data) return null;

  return <Formulario atual={config.data} salvar={salvar} />;
}

function Formulario({
  atual,
  salvar,
}: {
  atual: {
    enabled: boolean;
    providerLabel: string | null;
    baseUrl: string | null;
    model: string | null;
    apiKeyHint: string | null;
    credencialGravada: boolean;
    chaveDoServidor: boolean;
    maxTokens: number;
    dailyLimit: number;
    allowTeachers: boolean;
    allowStudents: boolean;
  };
  salvar: { mutateAsync: (input: never) => Promise<unknown>; isPending: boolean };
}) {
  const form = useForm({
    defaultValues: {
      enabled: atual.enabled,
      providerLabel: atual.providerLabel ?? "",
      baseUrl: atual.baseUrl ?? "",
      model: atual.model ?? "",
      // Sempre vazio: a chave nunca volta do servidor, e um campo
      // pré-preenchido com pontinhos convidaria a salvar "••••" como chave.
      apiKey: "",
      maxTokens: String(atual.maxTokens),
      dailyLimit: String(atual.dailyLimit),
      allowTeachers: atual.allowTeachers,
      allowStudents: atual.allowStudents,
    },
    validators: {
      onSubmit: z.object({
        enabled: z.boolean(),
        providerLabel: z.string().trim().max(60),
        baseUrl: z
          .string()
          .trim()
          .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Informe um endereço http(s)"),
        model: z.string().trim().max(120),
        apiKey: z.string().max(400),
        maxTokens: z
          .string()
          .refine((v) => Number(v) >= 64 && Number(v) <= 4000, "Entre 64 e 4000"),
        dailyLimit: z
          .string()
          .refine((v) => Number(v) >= 1 && Number(v) <= 10000, "Entre 1 e 10000"),
        allowTeachers: z.boolean(),
        allowStudents: z.boolean(),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      await salvar.mutateAsync({
        enabled: value.enabled,
        providerLabel: value.providerLabel.trim() || null,
        baseUrl: value.baseUrl.trim() || null,
        model: value.model.trim() || null,
        // Só manda a chave se a pessoa digitou alguma coisa. `undefined`
        // mantém; string vazia apagaria — e ninguém quer apagar por engano
        // ao corrigir o nome do modelo.
        ...(value.apiKey.trim() ? { apiKey: value.apiKey.trim() } : {}),
        maxTokens: Number(value.maxTokens),
        dailyLimit: Number(value.dailyLimit),
        allowTeachers: value.allowTeachers,
        allowStudents: value.allowStudents,
      } as never);

      formApi.reset({ ...value, apiKey: "" });
    },
  });

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-info-soft text-info">
          <OrbitaAstro className="w-6" />
        </span>
        <div>
          <CardEyebrow>Assistente</CardEyebrow>
          <h2 className="font-extrabold text-card tracking-[-0.3px]">Astro</h2>
        </div>
      </div>

      <p className="text-corpo text-muted-foreground">
        O Astro responde sobre a escola em linguagem comum, dentro do que cada pessoa já pode ver: o
        aluno enxerga o que é dele; o professor, as turmas dele; a secretaria, a escola. Ele não
        consulta o banco — recebe os mesmos números do painel de quem perguntou.
      </p>

      {atual.chaveDoServidor ? null : (
        <Alert variant="warning">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
          <AlertTitle>O servidor não tem a chave de cifragem</AlertTitle>
          <AlertDescription>
            Sem <code>ASSISTANT_ENCRYPTION_KEY</code> a credencial do modelo não é gravada — nunca
            em claro. Gere com <code>openssl rand -base64 32</code> e declare no ambiente.
          </AlertDescription>
        </Alert>
      )}

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
                Astro ligado
                <span className="block text-meta text-muted-foreground">
                  Exige endereço, modelo e credencial preenchidos. Cada pergunta consome crédito do
                  seu provedor.
                </span>
              </span>
            </label>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="providerLabel">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Provedor</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="OpenAI, Azure, Ollama…"
                />
                <p className="text-meta text-muted-foreground">
                  Só um rótulo, para você reconhecer. Quem define o provedor é o endereço abaixo.
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="model">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Modelo</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="gpt-4o-mini, llama3.1…"
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

        <form.Field name="baseUrl">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Endereço da API</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              {/*
                O que o cliente espera, dito antes de a pessoa descobrir pelo
                erro: formato `/chat/completions`. Serve OpenAI, Azure, Groq,
                Together, OpenRouter e Ollama; não serve a API nativa da
                Anthropic nem a do Gemini, que têm outro corpo.
              */}
              <p className="text-meta text-muted-foreground">
                Precisa aceitar <code>/chat/completions</code>. Serve OpenAI, Azure, Groq, Together,
                OpenRouter e Ollama. Não serve a API nativa da Anthropic nem a do Gemini.
              </p>
              {field.state.meta.errors.map((erro) => (
                <p key={erro?.message} className="text-danger text-meta">
                  {erro?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="apiKey">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>
                <KeyRound size={14} strokeWidth={1.8} aria-hidden className="mr-1 inline" />
                Credencial
              </Label>
              <Input
                id={field.name}
                type="password"
                autoComplete="off"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={
                  atual.credencialGravada
                    ? "Deixe em branco para manter a atual"
                    : "Cole a chave do provedor"
                }
              />
              <p className="text-meta text-muted-foreground">
                {atual.credencialGravada
                  ? `Há uma credencial gravada (${atual.apiKeyHint}). Ela é cifrada com chave que vive fora do banco e nunca volta para esta tela.`
                  : "Será cifrada antes de ir ao banco, com chave que vive fora dele."}
              </p>
            </div>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="dailyLimit">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Perguntas por dia</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                />
                {/* Credencial de modelo sem teto é conta aberta: um laço num
                    script, ou uma turma brincando, vira fatura no fim do mês. */}
                <p className="text-meta text-muted-foreground">
                  Teto da escola inteira. Zera à meia-noite.
                </p>
                {field.state.meta.errors.map((erro) => (
                  <p key={erro?.message} className="text-danger text-meta">
                    {erro?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="maxTokens">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Tamanho da resposta</Label>
                <Input
                  id={field.name}
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                />
                <p className="text-meta text-muted-foreground">
                  Em tokens. Resposta mais longa custa mais.
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

        <div className="flex flex-col gap-2">
          <span className="font-bold text-corpo">Quem pode perguntar</span>
          {/*
            Direção e secretaria entram sempre: são elas que configuram e
            pagam. As outras duas são decisão consciente da escola — o aluno
            nasce de fora porque abrir o assistente para criança é escolha,
            não padrão.
          */}
          <p className="text-meta text-muted-foreground">
            Direção e secretaria sempre podem. As duas abaixo são decisão sua.
          </p>

          <form.Field name="allowTeachers">
            {(field) => (
              <label className="flex items-center gap-2.5 rounded-control bg-muted px-4 py-3 text-corpo">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
                Professores
              </label>
            )}
          </form.Field>

          <form.Field name="allowStudents">
            {(field) => (
              <label className="flex items-center gap-2.5 rounded-control bg-muted px-4 py-3 text-corpo">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
                Alunos
              </label>
            )}
          </form.Field>
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
                {enviando ? "Salvando…" : "Salvar o Astro"}
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
