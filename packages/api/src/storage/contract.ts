import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ObjectStorage } from "./port";
import {
  EmptyObjectError,
  MAX_BODY_BYTES,
  ObjectAlreadyExistsError,
  ObjectNotFoundError,
  ObjectTooLargeError,
  StorageError,
} from "./port";

/**
 * A suíte de contrato: **um texto só, rodado contra os dois adaptadores**.
 *
 * Se o teste da memória fosse outro texto que o teste do R2, "passa em memória"
 * deixaria de significar alguma coisa — e é exatamente aí que o dublê mente. O
 * CI roda esta suíte contra a memória em todo PR; contra o R2 de verdade, num
 * passo só da `main`, onde há segredo.
 */

export interface StorageContractFixture {
  storage: ObjectStorage;
  /** Prefixo próprio deste ambiente. Termina em barra. */
  prefix: string;
  /** Roda no fim, mesmo se um caso falhar. */
  cleanup: () => Promise<void>;
}

export function testObjectStorageContract(
  name: string,
  create: () => Promise<StorageContractFixture>,
): void {
  describe(`contrato de ObjectStorage — ${name}`, () => {
    let fixture: StorageContractFixture;
    let storage: ObjectStorage;

    /** Cada caso escreve sob a própria pasta: os casos não se enxergam. */
    const keyFor = (testCase: string, leaf = "a") => `${fixture.prefix}${testCase}/${leaf}`;

    beforeAll(async () => {
      fixture = await create();
      storage = fixture.storage;
    });

    afterAll(async () => {
      await fixture?.cleanup();
    });

    it("gravar e ler devolve os mesmos bytes", async () => {
      const body = Buffer.from("boletim do 9º B", "utf8");
      const key = keyFor("ida-e-volta");

      const stored = await storage.put({ key, body, contentType: "text/plain" });
      expect(stored.size).toBe(body.length);
      expect(stored.etag).not.toBe("");

      const found = await storage.get(key);
      expect(found.body.equals(body)).toBe(true);
      expect(found.size).toBe(body.length);
    });

    it("preserva contentType e metadados, com o nome do metadado em minúsculas", async () => {
      const key = keyFor("metadados");

      await storage.put({
        key,
        body: Buffer.from("x"),
        contentType: "application/pdf",
        // Maiúscula de propósito: o S3 devolve o nome em minúsculas, e o dublê
        // precisa fazer igual, senão o teste verde aqui quebra em produção.
        metadata: { Origem: "secretaria", versao: "2" },
      });

      const found = await storage.get(key);
      expect(found.contentType).toBe("application/pdf");
      expect(found.metadata.origem).toBe("secretaria");
      expect(found.metadata.versao).toBe("2");
      expect(found.metadata.Origem).toBeUndefined();
    });

    it("ler chave inexistente lança ObjectNotFoundError", async () => {
      await expect(storage.get(keyFor("ausente"))).rejects.toBeInstanceOf(ObjectNotFoundError);
    });

    it("head de chave inexistente devolve null", async () => {
      expect(await storage.head(keyFor("ausente"))).toBeNull();
    });

    it("head traz tamanho, tipo e data sem baixar o corpo", async () => {
      const body = Buffer.from("conteudo de teste");
      const key = keyFor("cabecalho");
      await storage.put({ key, body, contentType: "text/plain" });

      const found = await storage.head(key);
      expect(found?.size).toBe(body.length);
      expect(found?.contentType).toBe("text/plain");
      expect(found?.modifiedAt).toBeInstanceOf(Date);
    });

    it("regravar a mesma chave substitui", async () => {
      const key = keyFor("substituicao");
      await storage.put({ key, body: Buffer.from("primeira"), contentType: "text/plain" });
      await storage.put({ key, body: Buffer.from("segunda"), contentType: "text/plain" });

      expect((await storage.get(key)).body.toString()).toBe("segunda");
    });

    it("onlyIfAbsent recusa a segunda gravação", async () => {
      const key = keyFor("so-uma-vez");
      await storage.put({
        key,
        body: Buffer.from("primeira"),
        contentType: "text/plain",
        onlyIfAbsent: true,
      });

      await expect(
        storage.put({
          key,
          body: Buffer.from("segunda"),
          contentType: "text/plain",
          onlyIfAbsent: true,
        }),
      ).rejects.toBeInstanceOf(ObjectAlreadyExistsError);

      expect((await storage.get(key)).body.toString()).toBe("primeira");
    });

    it("apagar devolve true quando havia e false quando não havia", async () => {
      const key = keyFor("revogacao");
      await storage.put({ key, body: Buffer.from("foto"), contentType: "image/jpeg" });

      expect(await storage.delete(key)).toEqual({ deleted: true });
      expect(await storage.delete(key)).toEqual({ deleted: false });
      expect(await storage.head(key)).toBeNull();
    });

    it("listar devolve só o que está sob o prefixo", async () => {
      const inside = `${fixture.prefix}listagem/dentro/`;
      await storage.put({ key: `${inside}a`, body: Buffer.from("a"), contentType: "text/plain" });
      await storage.put({ key: `${inside}b`, body: Buffer.from("b"), contentType: "text/plain" });
      await storage.put({
        key: `${fixture.prefix}listagem/fora/c`,
        body: Buffer.from("c"),
        contentType: "text/plain",
      });

      const page = await storage.list(inside);
      expect(page.keys.sort()).toEqual([`${inside}a`, `${inside}b`]);
      expect(page.cursor).toBeNull();
    });

    it("listar pagina, e o cursor avança sem repetir nem pular", async () => {
      const root = `${fixture.prefix}paginacao/`;
      const expected = ["01", "02", "03", "04", "05"].map((n) => `${root}${n}`);
      for (const key of expected) {
        await storage.put({ key, body: Buffer.from(key), contentType: "text/plain" });
      }

      const seen: string[] = [];
      let cursor: string | null | undefined;
      let rounds = 0;

      do {
        const page = await storage.list(root, { limit: 2, cursor: cursor ?? undefined });
        seen.push(...page.keys);
        cursor = page.cursor;
        rounds += 1;
        // Rede de segurança: cursor que não avança daria laço infinito, e o
        // teste travaria em vez de falhar.
        expect(rounds).toBeLessThan(10);
      } while (cursor);

      expect(seen.sort()).toEqual(expected);
      expect(new Set(seen).size).toBe(expected.length);
    });

    it("deletePrefix apaga tudo sob ele e nada fora", async () => {
      const target = `${fixture.prefix}varredura/alvo/`;
      const neighbour = `${fixture.prefix}varredura/vizinho/`;

      for (const key of [`${target}a`, `${target}b`, `${neighbour}c`]) {
        await storage.put({ key, body: Buffer.from(key), contentType: "text/plain" });
      }

      expect(await storage.deletePrefix(target)).toEqual({ deleted: 2 });
      expect((await storage.list(target)).keys).toEqual([]);
      expect((await storage.list(neighbour)).keys).toEqual([`${neighbour}c`]);
    });

    it("corpo vazio é recusado", async () => {
      await expect(
        storage.put({ key: keyFor("vazio"), body: Buffer.alloc(0), contentType: "text/plain" }),
      ).rejects.toBeInstanceOf(EmptyObjectError);
    });

    it("corpo acima do teto é recusado, e sem ir à rede", async () => {
      await expect(
        storage.put({
          key: keyFor("grande"),
          body: Buffer.alloc(MAX_BODY_BYTES + 1),
          contentType: "application/pdf",
        }),
      ).rejects.toBeInstanceOf(ObjectTooLargeError);

      expect(await storage.head(keyFor("grande"))).toBeNull();
    });

    it("bytes binários sobrevivem intactos", async () => {
      // Sequência inválida em UTF-8 de propósito: é onde o adaptador que trata
      // `Buffer` como string troca os bytes por U+FFFD sem avisar.
      const body = Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x7f, 0xc3, 0x28]);
      const key = keyFor("binario");

      await storage.put({ key, body, contentType: "application/octet-stream" });

      expect((await storage.get(key)).body.equals(body)).toBe(true);
    });

    it("chave com acento, espaço, barra dupla ou ponto-ponto é recusada", async () => {
      const invalid = [
        `${fixture.prefix}acentuação`,
        `${fixture.prefix}com espaço`,
        `${fixture.prefix}vizinha/../fuga`,
        `${fixture.prefix}barra//dupla`,
        `${fixture.prefix}termina/em/barra/`,
      ];

      for (const key of invalid) {
        await expect(
          storage.put({ key, body: Buffer.from("x"), contentType: "text/plain" }),
        ).rejects.toBeInstanceOf(StorageError);
      }
    });

    it("metadado com caractere fora do ASCII imprimível é recusado", async () => {
      await expect(
        storage.put({
          key: keyFor("metadado-invalido"),
          body: Buffer.from("x"),
          contentType: "text/plain",
          // Nome de aluno em metadado seria dado pessoal num cabeçalho HTTP; o
          // acento aqui é o que faz a assinatura do S3 discordar do que foi
          // enviado, e o erro chegar como falha de rede sem explicação.
          metadata: { origem: "secretaria acadêmica" },
        }),
      ).rejects.toBeInstanceOf(StorageError);
    });
  });
}
