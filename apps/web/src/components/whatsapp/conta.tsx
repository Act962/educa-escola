import { CONVERSAS_DE_SERVICO_GRATUITAS } from "@educa-escola/api/messaging/whatsapp/billing";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Plug, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { dateTimeText } from "@/lib/format";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Visao = RouterOutputs["whatsapp"]["visao"];
type Conta = NonNullable<Visao["conta"]>;

const FORNECEDORES = [
  { value: "cloud", label: "API oficial da Meta" },
  { value: "memoria", label: "Simulado — não envia nada" },
];

/**
 * O número da escola: credencial, teste e estado.
 *
 * Os campos de segredo são **de escrita, nunca de leitura**. Nascem vazios
 * mesmo havendo token gravado, e salvar sem tocar neles mantém o que está lá.
 * O que a tela mostra é a dica dos quatro últimos caracteres — o bastante para
 * a direção reconhecer a própria credencial sem que ela volte do servidor.
 */
export function ContaDoWhatsApp({ visao }: { visao: Visao }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const conta = visao.conta;

  const atualizar = () => queryClient.invalidateQueries({ queryKey: [["whatsapp"]] });

  const salvar = useMutation(
    trpc.whatsapp.salvarConta.mutationOptions({
      onSuccess: async () => {
        toast.success("Número salvo.");
        await atualizar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const testar = useMutation(
    trpc.whatsapp.testarConexao.mutationOptions({
      onSuccess: async (resultado) => {
        toast.success(
          resultado.conta.verifiedName
            ? `Conectado como "${resultado.conta.verifiedName}".`
            : "Conectado.",
        );
        await atualizar();
      },
      onError: async (error) => {
        toast.error(error.message);
        // O motivo fica gravado em `lastError`: sem recarregar, a tela
        // continuaria mostrando o estado anterior ao teste que falhou.
        await atualizar();
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      label: conta?.label ?? "Secretaria",
      provider: conta?.provider ?? "cloud",
      phoneNumberId: conta?.phoneNumberId ?? "",
      wabaId: conta?.wabaId ?? "",
      appId: conta?.appId ?? "",
      // Sempre vazios: o segredo nunca volta do servidor, e um campo
      // pré-preenchido com pontinhos convidaria a salvar "••••" como token.
      token: "",
      appSecret: "",
      // Vazio é "use o padrão da Meta", e é assim que a escola volta atrás.
      // Um `1000` escrito no campo viraria valor gravado na primeira gravação,
      // e o dia em que a Meta mudasse o padrão esta escola ficaria para trás.
      freeTierLimit:
        conta?.freeTierLimit === null || conta === null ? "" : String(conta.freeTierLimit),
      blockWhenExhausted: conta?.blockWhenExhausted ?? true,
    },
    validators: {
      onSubmit: z.object({
        label: z.string().trim().min(2, "Dê um nome a este número").max(60),
        provider: z.enum(["cloud", "memoria"]),
        phoneNumberId: z.string().trim().max(60),
        wabaId: z.string().trim().max(60),
        appId: z.string().trim().max(60),
        token: z.string().max(1000),
        appSecret: z.string().max(400),
        freeTierLimit: z
          .string()
          .trim()
          .refine(
            (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0),
            "Informe um número inteiro, ou deixe em branco para o padrão da Meta",
          ),
        blockWhenExhausted: z.boolean(),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      await salvar.mutateAsync({
        ...value,
        id: conta?.id,
        // `null` apaga o teto e devolve a conta ao padrão; um número o fixa.
        freeTierLimit: value.freeTierLimit.trim() === "" ? null : Number(value.freeTierLimit),
      });
      // Só os segredos voltam a vazio: o resto continua na tela, porque é o
      // que a pessoa acabou de conferir.
      formApi.reset({ ...value, token: "", appSecret: "" });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <EstadoDaConta conta={conta} />

      {conta?.credencialGravada && !conta.credencialAbre ? (
        <Alert variant="danger">
          <TriangleAlert />
          <AlertTitle>A credencial gravada não abre neste servidor</AlertTitle>
          <AlertDescription>
            O token continua no banco, íntegro, e a chave de cifragem do servidor mudou. Cole o
            token de novo no campo abaixo e salve.
          </AlertDescription>
        </Alert>
      ) : null}

      {!visao.chaveNoServidor ? (
        <Alert variant="warning">
          <KeyRound />
          <AlertTitle>O servidor ainda não tem chave de cifragem</AlertTitle>
          <AlertDescription>
            Sem <code>WHATSAPP_ENCRYPTION_KEY</code> o token só poderia ser gravado em claro, e por
            isso a gravação é recusada. Fale com quem administra o servidor.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="label">
            {(field) => (
              <Campo
                label="Nome deste número"
                ajuda="Como a escola o chama: Secretaria, Unidade Centro."
                field={field}
              />
            )}
          </form.Field>

          <form.Field name="provider">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Fornecedor</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(valor) => field.handleChange(valor as "cloud" | "memoria")}
                  // Sem `items` o gatilho mostraria o valor cru — "cloud" —, e
                  // não o rótulo. É o Base UI: ele não lê o texto dos itens.
                  items={FORNECEDORES}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORNECEDORES.map((fornecedor) => (
                      <SelectItem key={fornecedor.value} value={fornecedor.value}>
                        {fornecedor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-meta text-muted-foreground">
                  Simulado mostra o fluxo inteiro sem mandar mensagem para ninguém.
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="phoneNumberId">
            {(field) => (
              <Campo
                label="ID do número (Phone number ID)"
                ajuda="No painel da Meta: WhatsApp → API Setup. É um número, não o telefone."
                field={field}
              />
            )}
          </form.Field>

          <form.Field name="wabaId">
            {(field) => (
              <Campo
                label="ID da conta comercial (WABA ID)"
                ajuda="É a conta dona dos modelos de mensagem."
                field={field}
              />
            )}
          </form.Field>

          <form.Field name="appId">
            {(field) => (
              <Campo
                label="ID do aplicativo"
                ajuda="Do app da Meta. Usado na conferência do webhook, mais adiante."
                field={field}
              />
            )}
          </form.Field>

          <form.Field name="token">
            {(field) => (
              <Campo
                label="Token de acesso"
                type="password"
                placeholder={conta?.tokenHint ?? "Cole o token"}
                ajuda={
                  conta?.credencialGravada
                    ? `Há um token gravado (${conta.tokenHint}). Deixe em branco para mantê-lo.`
                    : "Use um token permanente de System User: o do painel expira em 24 horas."
                }
                field={field}
              />
            )}
          </form.Field>

          <form.Field name="appSecret">
            {(field) => (
              <Campo
                label="Chave secreta do app (opcional)"
                type="password"
                placeholder={conta?.appSecretGravado ? "••••" : "Cole a chave secreta"}
                ajuda="Não é usada para enviar. Serve para conferir o webhook de recebimento."
                field={field}
              />
            )}
          </form.Field>
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-corpo">Cota gratuita</p>
            <p className="text-meta text-muted-foreground">
              A Meta não cobra as primeiras conversas de serviço de cada mês — as que acontecem
              dentro das 24 horas depois de a família escrever. Mensagem por modelo é cobrada por
              mensagem e não entra nesta conta.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <form.Field name="freeTierLimit">
              {(field) => (
                <Campo
                  label="Conversas gratuitas por mês"
                  inputMode="numeric"
                  placeholder={String(CONVERSAS_DE_SERVICO_GRATUITAS)}
                  ajuda={`Em branco usa o padrão da Meta (${CONVERSAS_DE_SERVICO_GRATUITAS}). Preencha só se o seu contrato for outro.`}
                  field={field}
                />
              )}
            </form.Field>

            <form.Field name="blockWhenExhausted">
              {(field) => (
                <label className="flex items-start gap-2.5 self-end rounded-control bg-card px-4 py-3 text-corpo">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={field.state.value}
                    onChange={(evento) => field.handleChange(evento.target.checked)}
                  />
                  <span>
                    Bloquear conversas novas quando a cota acabar
                    <span className="block text-meta text-muted-foreground">
                      Responder a quem já escreveu continua liberado.
                    </span>
                  </span>
                </label>
              )}
            </form.Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form.Subscribe selector={(estado) => estado.isSubmitting}>
            {(enviando) => (
              <Button type="submit" disabled={enviando || salvar.isPending}>
                {enviando || salvar.isPending ? "Salvando…" : "Salvar número"}
              </Button>
            )}
          </form.Subscribe>

          <Button
            type="button"
            variant="outline"
            disabled={!conta || testar.isPending}
            onClick={() => testar.mutate({ id: conta?.id })}
          >
            <Plug />
            {testar.isPending ? "Conferindo…" : "Testar conexão"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * O que o último teste descobriu.
 *
 * Existe porque "salvei uns campos" não é "está no ar". Enquanto ninguém
 * testar, o estado é `rascunho` e a tela diz isso — melhor que um selo verde
 * que só significa que alguém preencheu formulário.
 */
function EstadoDaConta({ conta }: { conta: Conta | null }) {
  if (!conta) {
    return (
      <Alert>
        <Plug />
        <AlertTitle>Nenhum número conectado ainda</AlertTitle>
        <AlertDescription>
          Preencha os campos abaixo com o que está no painel da Meta e clique em testar conexão.
        </AlertDescription>
      </Alert>
    );
  }

  const tom =
    conta.status === "conectado" ? "success" : conta.status === "erro" ? "danger" : "warning";

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tom}>
          {conta.status === "conectado"
            ? "Conectado"
            : conta.status === "erro"
              ? "Com erro"
              : "Não testado"}
        </Badge>
        {conta.qualityRating ? (
          <Badge variant={conta.qualityRating === "GREEN" ? "success" : "warning"}>
            Qualidade {conta.qualityRating}
          </Badge>
        ) : null}
        <span className="text-corpo">
          {conta.displayPhoneNumber ?? "Número ainda não conferido"}
        </span>
        {conta.verifiedName ? (
          <span className="text-corpo text-muted-foreground">· {conta.verifiedName}</span>
        ) : null}
      </div>

      {conta.status === "conectado" && conta.checkedAt ? (
        <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Conferido em {dateTimeText(conta.checkedAt)}
        </p>
      ) : null}

      {conta.lastError ? <p className="text-danger text-meta">{conta.lastError}</p> : null}
    </div>
  );
}

/** Campo de texto com rótulo, ajuda e erros. Repetido oito vezes sem isto. */
function Campo({
  label,
  ajuda,
  type,
  inputMode,
  placeholder,
  field,
}: {
  label: string;
  ajuda: string;
  type?: string;
  inputMode?: "numeric" | "tel";
  placeholder?: string;
  field: {
    name: string;
    state: { value: string; meta: { errors: ({ message?: string } | undefined)[] } };
    handleBlur: () => void;
    handleChange: (valor: string) => void;
  };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        inputMode={inputMode}
        autoComplete={type === "password" ? "off" : undefined}
        placeholder={placeholder}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(evento) => field.handleChange(evento.target.value)}
      />
      <p className="text-meta text-muted-foreground">{ajuda}</p>
      {field.state.meta.errors.map((error) => (
        <p key={error?.message} className="text-danger text-meta">
          {error?.message}
        </p>
      ))}
    </div>
  );
}
