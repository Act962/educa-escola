import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** Importar isso significa estar montando query. */
const BUILDS_QUERIES = /from\s+"(drizzle-orm(\/[^"]*)?|@educa-escola\/db\/schema)"/;

const isProductionCode = (file: string) =>
  !file.endsWith(".test.ts") && !file.includes(`${sep}testing${sep}`);

const rel = (file: string) => relative(SRC, file).split(sep).join("/");

describe("regras de arquitetura", () => {
  /**
   * O isolamento entre escolas só se sustenta se o acesso ao banco estiver
   * concentrado. Se este teste falhar, alguém consultou o banco fora de um
   * repositório — e essa query provavelmente não filtra por escola.
   */
  it("apenas repository.ts monta query", () => {
    const offenders = sourceFiles(SRC)
      .filter(isProductionCode)
      .filter((file) => !file.endsWith(`${sep}repository.ts`))
      .filter((file) => BUILDS_QUERIES.test(readFileSync(file, "utf8")))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("todo repositório de módulo é construído com o tenant", () => {
    const withoutTenant = sourceFiles(join(SRC, "modules"))
      .filter((file) => file.endsWith(`${sep}repository.ts`))
      .filter((file) => !readFileSync(file, "utf8").includes("tenant.schoolId"))
      .map(rel);

    expect(withoutTenant).toEqual([]);
  });

  /**
   * As consultas que atravessam a fronteira entre escolas, uma a uma.
   *
   * A regra acima — `repository.ts` precisa conter `tenant.schoolId` — é
   * satisfeita por um arquivo que tenha *uma* fábrica com tenant, mesmo que
   * tenha outra sem. Foi essa folga que deixou `createInviteLookup` passar
   * despercebida. Aqui a checagem é por fábrica exportada: quem não recebe
   * `tenant` precisa estar nesta lista, e entrar nela é um ato de revisão.
   *
   * **Acrescentar uma linha aqui é mudar o contrato de isolamento do
   * produto.** Se você está prestes a fazer isso, o comentário no topo da
   * função em questão precisa explicar o que segura a travessia.
   */
  const CONSULTAS_SEM_TENANT = [
    // O responsável não tem conta: a autorização dele é a posse do token, e o
    // `schoolId` da linha encontrada é o que vira o tenant de todo o resto.
    "modules/enrollment-link/repository.ts::createInviteLookup",
    // O placar entre escolas. `innerJoin` na adesão, e a tabela publicada não
    // tem coluna onde uma pessoa caberia.
    "modules/leaderboard/repository.ts::createLeaderboardLookup",
    // O convite de professor. Mesmo motivo do de matrícula: não há sessão de
    // onde tirar o tenant — o professor ainda não tem conta, e criá-la é
    // justamente o que ele vem fazer. O `schoolId` da linha encontrada é o que
    // vira o tenant do aceite.
    "modules/teacher/repository.ts::createTeacherInviteLookup",
  ];

  it("toda consulta sem tenant está na allowlist", () => {
    const fabrica = /export function (create\w+)\(([^)]*)\)/g;

    const semTenant = sourceFiles(join(SRC, "modules"))
      .filter((file) => file.endsWith(`${sep}repository.ts`))
      .flatMap((file) => {
        const fonte = readFileSync(file, "utf8");
        return [...fonte.matchAll(fabrica)]
          .filter(([, , params]) => !(params ?? "").includes("tenant"))
          .map(([, name]) => `${rel(file)}::${name}`);
      });

    // Subconjunto, e não igualdade: a lista precisa sobreviver a um branch em
    // que o módulo citado ainda não existe. O que este teste guarda é a
    // consulta nova que ninguém autorizou, não a linha velha que sobrou.
    expect(semTenant.filter((key) => !CONSULTAS_SEM_TENANT.includes(key))).toEqual([]);
  });

  /**
   * O SDK da AWS é detalhe do adaptador do R2.
   *
   * O dia de trocar de provedor precisa ser o dia de escrever um irmão de
   * `storage/r2.ts`, e não o de caçar `S3Client` pelo código. Mesma ideia da
   * regra do `drizzle-orm`: mecânica, não cultural.
   */
  it("só storage/ conhece o SDK da AWS", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.includes(`${sep}storage${sep}`))
      .filter((file) => /from\s+"@aws-sdk\/[^"]*"/.test(readFileSync(file, "utf8")))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  /**
   * Adaptador cru não tem tenant.
   *
   * `createR2Storage` e `createMemoryStorage` aceitam qualquer chave, inclusive
   * a de outra escola. Quem consome storage monta por `storageDoAmbiente()` e
   * embrulha com `createTenantStorage` — construir o adaptador direto num
   * service ou router pula a camada que segura o isolamento.
   *
   * Vale só para código de produção: teste de service legitimamente monta um
   * storage em memória para não depender de rede.
   */
  it("fora de storage/, código de produção não constrói adaptador cru", () => {
    const offenders = sourceFiles(SRC)
      .filter(isProductionCode)
      .filter((file) => !file.includes(`${sep}storage${sep}`))
      .filter((file) =>
        /\b(createR2Storage|createMemoryStorage)\b/.test(readFileSync(file, "utf8")),
      )
      .map(rel);

    expect(offenders).toEqual([]);
  });

  /**
   * A Graph API é detalhe do adaptador da Meta.
   *
   * Estamos avaliando a API oficial e alternativas não oficiais ao mesmo tempo,
   * e a fronteira só vale enquanto for mecânica: o dia de trocar de fornecedor
   * precisa ser o dia de escrever um irmão de `messaging/whatsapp/cloud.ts`, e
   * não o de caçar `graph.facebook.com` pelo código. Mesma regra do `@aws-sdk`.
   */
  it("só messaging/whatsapp conhece a Graph API", () => {
    const offenders = sourceFiles(SRC)
      // `isProductionCode` tira este próprio arquivo da conta: a regra carrega
      // o endereço que ela proíbe.
      .filter(isProductionCode)
      .filter((file) => !file.includes(join("messaging", "whatsapp")))
      .filter((file) => /graph\.facebook\.com/.test(readFileSync(file, "utf8")))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  /**
   * Adaptador cru não sabe de que escola é a credencial.
   *
   * `createCloudChannel` recebe token e id de número prontos; quem os tira da
   * linha certa, decifrados, é o service do módulo, por `criarCanal`. Construir
   * o adaptador direto num router pula a camada que confere a configuração e a
   * que decifra — e é onde um token de outra escola caberia.
   */
  it("fora de messaging/whatsapp, código de produção não constrói canal cru", () => {
    const offenders = sourceFiles(SRC)
      .filter(isProductionCode)
      .filter((file) => !file.includes(join("messaging", "whatsapp")))
      // A chamada, e não o nome solto: o service **explica** em comentário por
      // que não constrói o adaptador, e uma regra que proíbe citar o nome
      // proíbe documentar a própria regra.
      .filter((file) =>
        /\b(createCloudChannel|createMemoryChannel)\s*\(/.test(readFileSync(file, "utf8")),
      )
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("todo módulo expõe repository, service e router", () => {
    const modulesDir = join(SRC, "modules");
    const incomplete = readdirSync(modulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const files = readdirSync(join(modulesDir, entry.name));
        return !["repository.ts", "service.ts", "router.ts"].every((f) => files.includes(f));
      })
      .map((entry) => entry.name);

    expect(incomplete).toEqual([]);
  });
});
