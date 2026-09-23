import { z } from "zod";

import {
  CATEGORIAS,
  LIMITE_CABECALHO,
  LIMITE_CORPO,
  LIMITE_RODAPE,
} from "../../messaging/whatsapp/template";

/**
 * As entradas da aba de WhatsApp.
 *
 * Os limites de tamanho vêm de `messaging/whatsapp/template.ts`, que é onde a
 * regra da Meta mora — repeti-los como número aqui faria a tela e o validador
 * discordarem no dia em que a Meta mudasse um deles.
 */

export const accountId = z.object({ id: z.string().min(1) });

/**
 * E.164, aceitando o que a secretaria digita.
 *
 * Cópia deliberada da regra de `enrollment/schema.ts`: o destinatário aqui é o
 * mesmo celular de responsável que já está gravado lá, e duas normalizações
 * diferentes para o mesmo número gerariam duas grafias do mesmo contato.
 */
export const telefone = z
  .string()
  .trim()
  .min(1, "Informe o número com DDD")
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits.length === 10 || digits.length === 11 || digits.length === 13, {
    message: "Número inválido: informe DDD e número",
  })
  .transform((digits) => (digits.length === 13 ? `+${digits}` : `+55${digits}`));

export const saveAccountInput = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(2, "Dê um nome a este número").max(60),
  provider: z.enum(["cloud", "memoria"]).default("cloud"),
  phoneNumberId: z.string().trim().max(60).optional(),
  wabaId: z.string().trim().max(60).optional(),
  appId: z.string().trim().max(60).optional(),
  /**
   * Vazio **mantém** o token gravado.
   *
   * O campo é de escrita, nunca de leitura: ele nasce vazio mesmo havendo
   * token, e salvar sem tocar nele não derruba a integração. Tratar vazio como
   * "apague" faria toda edição de rótulo desconectar a escola.
   */
  token: z.string().max(1000).optional(),
  appSecret: z.string().max(400).optional(),
  /**
   * O teto de conversas gratuitas do mês. `null` volta ao padrão da Meta.
   *
   * `nullish` e não `optional`: ausente mantém o que está gravado, `null`
   * **apaga** e devolve a conta ao padrão. São duas intenções diferentes, e um
   * campo só as distingue sem precisar de um botão "voltar ao padrão".
   */
  freeTierLimit: z.number().int().min(0).max(1_000_000).nullish(),
  blockWhenExhausted: z.boolean().optional(),
});

const botao = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("resposta"), texto: z.string().trim().min(1).max(25) }),
  z.object({
    tipo: z.literal("link"),
    texto: z.string().trim().min(1).max(25),
    url: z.url("Informe um endereço http(s)"),
  }),
  z.object({
    tipo: z.literal("telefone"),
    texto: z.string().trim().min(1).max(25),
    telefone,
  }),
]);

export const saveTemplateInput = z.object({
  id: z.string().min(1).optional(),
  nome: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_]{2,60}$/,
      "Só minúsculas, números e sublinhado — por exemplo, aviso_de_reuniao",
    ),
  categoria: z.enum(CATEGORIAS).default("UTILITY"),
  idioma: z.string().trim().min(2).max(10).default("pt_BR"),
  cabecalho: z.string().trim().max(LIMITE_CABECALHO).optional(),
  corpo: z.string().trim().min(1, "Escreva o corpo da mensagem").max(LIMITE_CORPO),
  rodape: z.string().trim().max(LIMITE_RODAPE).optional(),
  botoes: z.array(botao).max(6).default([]),
  exemplos: z.array(z.string().trim().max(120)).max(20).default([]),
});

export const templateId = z.object({ id: z.string().min(1) });

export const sendTestInput = z.object({
  templateId: z.string().min(1),
  para: telefone,
  /** Valor por nome de variável. O que faltar cai no exemplo do modelo. */
  valores: z.record(z.string(), z.string().max(400)).default({}),
});

/**
 * Texto livre.
 *
 * Existe, e a tela avisa o que ele é: só chega a quem escreveu para a escola
 * nas últimas 24 horas. Sem esse aviso, o primeiro uso seria uma mensagem que
 * some sem erro visível para quem mandou.
 */
export const sendTextInput = z.object({
  para: telefone,
  texto: z.string().trim().min(1, "Escreva a mensagem").max(4000),
});

export type SaveAccountInput = z.infer<typeof saveAccountInput>;
export type SaveTemplateInput = z.infer<typeof saveTemplateInput>;
export type SendTestInput = z.infer<typeof sendTestInput>;
export type SendTextInput = z.infer<typeof sendTextInput>;
