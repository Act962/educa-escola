import { COMANDO_DA_CHAVE } from "@educa-escola/api/modules/assistant/instrucoes";
import {
  camposAoTrocarProvedor,
  PROVEDORES,
  provedorDe,
} from "@educa-escola/api/modules/assistant/provedores";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { OrbitaAstro } from "@educa-escola/ui/integra/orbita";
import { ListSkeleton } from "@educa-escola/ui/integra/states";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
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
/** Opção que troca o `Select` pelo campo de texto. Não é nome de modelo. */
const DIGITAR = "__digitar__";

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
    organizationId: string | null;
    apiKeyHint: string | null;
    credencialGravada: boolean;
    credencialAbre: boolean;
    chaveDoServidor: boolean;
    maxTokens: number;
    dailyLimit: number;
    allowTeachers: boolean;
    allowStudents: boolean;
  };
  salvar: { mutateAsync: (input: never) => Promise<unknown>; isPending: boolean };
}) {
  const trpc = useTRPC();

  /**
   * O que o provedor respondeu na última busca.
   *
   * Fica em estado local, e não em cache de query, porque é uma foto do
   * momento do clique: guardar entre visitas devolveria uma lista que pode
   * ter mudado no provedor sem ninguém saber.
   */
  const [modelosDoProvedor, setModelosDoProvedor] = useState<string[] | null>(null);

  const buscarModelos = useMutation(
    trpc.assistant.buscarModelos.mutationOptions({
      onSuccess: (lista) => {
        setModelosDoProvedor(lista);
        toast.success(`${lista.length} modelos encontrados.`);
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      enabled: atual.enabled,
      providerLabel: atual.providerLabel ?? "outro",
      // Quando o modelo salvo não está na lista do provedor, a tela já abre
      // no campo de texto — senão o `Select` mostraria outro valor e a
      // primeira gravação trocaria o modelo sem ninguém pedir.
      modeloDigitado:
        !!atual.model && !provedorDe(atual.providerLabel).modelos.includes(atual.model),
      baseUrl: atual.baseUrl ?? "",
      /*
       * Sem modelo salvo, já abre no primeiro sugerido do provedor.
       *
       * O `Select` sem valor não mostra nada, e a direção salvaria de novo com
       * o campo vazio — que é o defeito que acabou de acontecer aqui. Mesma
       * regra de `camposAoTrocarProvedor`: quem exibe e quem grava têm de ser
       * o mesmo valor.
       */
      model: atual.model ?? provedorDe(atual.providerLabel).modelos[0] ?? "",
      organizationId: atual.organizationId ?? "",
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
        modeloDigitado: z.boolean(),
        baseUrl: z
          .string()
          .trim()
          .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Informe um endereço http(s)"),
        model: z.string().trim().max(120),
        organizationId: z.string().trim().max(120),
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
        organizationId: value.organizationId.trim() || null,
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
          <AlertDescription className="flex flex-col gap-1">
            <span>
              Sem <code>ASSISTANT_ENCRYPTION_KEY</code> a credencial do modelo não é gravada — nunca
              em claro. O campo da credencial fica fechado até ela existir.
            </span>
            {/* `printf` com quebra de linha na frente, e não `echo … >>`:
                `.env` sem quebra no fim faz o `>>` colar a variável nova no
                fim da anterior, e as duas ficam inválidas. */}
            <code className="whitespace-pre-wrap break-all text-meta">{COMANDO_DA_CHAVE}</code>
            <span>Depois reinicie o servidor: o .env é lido só na subida.</span>
          </AlertDescription>
        </Alert>
      )}

      {/*
        Chave de cifragem girou: o texto cifrado continua no banco, íntegro, e
        não abre mais. Sem este aviso a escola só descobre na primeira
        pergunta — e descobre como erro.
      */}
      {atual.chaveDoServidor && atual.credencialGravada && !atual.credencialAbre ? (
        <Alert variant="danger">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
          <AlertTitle>A credencial gravada não abre com a chave atual</AlertTitle>
          <AlertDescription>
            A <code>ASSISTANT_ENCRYPTION_KEY</code> do servidor mudou desde que esta credencial foi
            salva. Cole a chave do provedor de novo no campo abaixo e salve.
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
                <Select
                  value={field.state.value}
                  onValueChange={(valor) => {
                    // A regra mora em `camposAoTrocarProvedor`, testada: ela
                    // zera endereço e modelo junto, porque os dois eram do
                    // provedor que saiu.
                    const campos = camposAoTrocarProvedor(valor ?? "outro");
                    field.handleChange(campos.providerLabel);
                    form.setFieldValue("baseUrl", campos.baseUrl);
                    form.setFieldValue("model", campos.model);
                    form.setFieldValue("modeloDigitado", campos.modeloDigitado);
                    setModelosDoProvedor(null);
                  }}
                  items={PROVEDORES.map((p) => ({ value: p.id, label: p.nome }))}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVEDORES.map((provedor) => (
                      <SelectItem key={provedor.id} value={provedor.id}>
                        {provedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {provedorDe(field.state.value).nota ? (
                  <p className="text-meta text-muted-foreground">
                    {provedorDe(field.state.value).nota}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(estado) => ({
              provedor: estado.values.providerLabel,
              digitado: estado.values.modeloDigitado,
            })}
          >
            {({ provedor, digitado }) => {
              // A lista buscada no provedor vence a curada: ela é de hoje, a
              // outra é do dia em que o arquivo foi escrito.
              const sugeridos = modelosDoProvedor ?? provedorDe(provedor).modelos;

              // O modelo salvo entra na lista mesmo que o provedor não o
              // tenha devolvido. Sem isto, o `Select` exibiria outro valor e
              // a próxima gravação trocaria o modelo sem ninguém pedir.
              const escolhido = form.state.values.model;
              const opcoes =
                escolhido && !sugeridos.includes(escolhido) ? [escolhido, ...sugeridos] : sugeridos;

              return (
                <form.Field name="model">
                  {(field) => (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={field.name}>Modelo</Label>
                        {atual.credencialGravada && atual.baseUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => buscarModelos.mutate()}
                            disabled={buscarModelos.isPending}
                          >
                            <RefreshCw size={14} strokeWidth={1.8} aria-hidden />
                            {buscarModelos.isPending ? "Buscando…" : "Buscar no provedor"}
                          </Button>
                        ) : null}
                      </div>

                      {digitado || opcoes.length === 0 ? (
                        <Input
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="gpt-4o-mini, llama3.1…"
                        />
                      ) : (
                        <Select
                          value={field.state.value}
                          onValueChange={(valor) => {
                            if (valor === DIGITAR) {
                              form.setFieldValue("modeloDigitado", true);
                              field.handleChange("");
                              return;
                            }
                            field.handleChange(valor ?? "");
                          }}
                          items={[
                            ...opcoes.map((m) => ({ value: m, label: m })),
                            { value: DIGITAR, label: "Outro (digitar)" },
                          ]}
                        >
                          <SelectTrigger id={field.name} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoes.map((modelo) => (
                              <SelectItem key={modelo} value={modelo}>
                                {modelo}
                              </SelectItem>
                            ))}
                            <SelectItem value={DIGITAR}>Outro (digitar)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <p className="text-meta text-muted-foreground">
                        {modelosDoProvedor
                          ? "Lista vinda do provedor agora."
                          : atual.credencialGravada
                            ? "Sugestões. Clique em “Buscar no provedor” para a lista de hoje."
                            : "Sugestões. Salve a credencial para buscar a lista real."}
                      </p>

                      {field.state.meta.errors.map((erro) => (
                        <p key={erro?.message} className="text-danger text-meta">
                          {erro?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>
              );
            }}
          </form.Subscribe>
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

        <form.Field name="organizationId">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Organização (opcional)</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="org-…"
              />
              {/*
                Não é segredo: é identificador de conta, e sozinho não
                autentica nada. Vai em claro no banco, de propósito — cifrá-lo
                daria a impressão de proteger alguma coisa e só atrapalharia a
                conferência.
              */}
              <p className="text-meta text-muted-foreground">
                Só para a OpenAI, e só se a conta tiver mais de uma organização: é ela que diz onde
                o consumo é debitado. Em branco, o provedor usa a organização padrão.
              </p>
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
              {/*
                Fechado quando o servidor não tem a chave de cifragem: sem
                ela a gravação é recusada de qualquer jeito, e deixar o campo
                aberto faria a pessoa colar um segredo de verdade para receber
                um erro. Melhor barrar antes de a chave sair da máquina dela.
              */}
              <Input
                id={field.name}
                type="password"
                autoComplete="off"
                disabled={!atual.chaveDoServidor}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={
                  !atual.chaveDoServidor
                    ? "Configure ASSISTANT_ENCRYPTION_KEY no servidor primeiro"
                    : atual.credencialGravada
                      ? "Deixe em branco para manter a atual"
                      : "Cole só o valor da chave, sem OPENAI_API_KEY="
                }
              />
              <p className="text-meta text-muted-foreground">
                {atual.credencialGravada && !atual.credencialAbre
                  ? "A credencial gravada não abre com a chave atual do servidor. Cole a do provedor de novo."
                  : atual.credencialGravada
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
              {/*
                Sem o `!sujo` no `disabled`, de propósito.
                O formulário preenche sozinho o que falta — o primeiro modelo
                do provedor, quando o servidor não tem nenhum. Aí ele se
                considera intocado enquanto o servidor continua inválido, e o
                botão que resolveria isso fica desabilitado: a tela mostra a
                configuração certa, o banco guarda a errada, e não há gesto que
                aproxime os dois. Gravar de novo o mesmo valor é barato; ficar
                preso não é.
              */}
              <Button type="submit" disabled={!podeEnviar || enviando}>
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
