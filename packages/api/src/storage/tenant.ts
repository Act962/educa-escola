import type { TenantContext } from "../trpc/tenant";
import { schoolPrefix } from "./keys";
import type {
  ListOptions,
  ObjectContent,
  ObjectHead,
  ObjectStorage,
  PutInput,
  PutResult,
} from "./port";
import { KeyOutsideTenantError } from "./port";

/**
 * Prende toda operação ao prefixo da escola ativa.
 *
 * É a camada 2 do isolamento aplicada a objeto: do mesmo jeito que
 * `createClassroomRepository(db, tenant)` põe `eq(table.schoolId,
 * tenant.schoolId)` em toda query, aqui nenhuma chave escapa de
 * `escolas/{schoolId}/`. Em bucket único, prefixo esquecido é o filtro
 * esquecido — e a diferença é que o banco pelo menos erraria a contagem,
 * enquanto um objeto de outra escola simplesmente abre.
 *
 * A conferência acontece **antes** de falar com o R2, porque uma chave errada
 * não é para virar uma requisição que pode dar certo.
 */
export function createTenantStorage(storage: ObjectStorage, tenant: TenantContext): ObjectStorage {
  const prefix = schoolPrefix(tenant.schoolId);

  function assertWithinTenant(key: string): string {
    if (!key.startsWith(prefix)) {
      throw new KeyOutsideTenantError(
        `Chave ${JSON.stringify(key)} está fora da escola ativa (${prefix}).`,
      );
    }
    return key;
  }

  /**
   * Os métodos são `async` de propósito, e não repasses diretos.
   *
   * `assertWithinTenant` lança, e num método que só devolve a promessa de
   * dentro o lançamento seria **síncrono**: `storage.get(chaveErrada).catch(…)`
   * estouraria antes de chegar ao `.catch`, porque não houve promessa para
   * rejeitar. Interface que promete `Promise` precisa rejeitar, nunca lançar na
   * chamada — misturar as duas coisas é o que passa em teste e derruba um
   * handler em produção.
   */
  return {
    async put(input: PutInput): Promise<PutResult> {
      return storage.put({ ...input, key: assertWithinTenant(input.key) });
    },

    async get(key: string): Promise<ObjectContent> {
      return storage.get(assertWithinTenant(key));
    },

    async head(key: string): Promise<ObjectHead | null> {
      return storage.head(assertWithinTenant(key));
    },

    async delete(key: string) {
      return storage.delete(assertWithinTenant(key));
    },

    /**
     * Listar e apagar por prefixo também conferem — e é aqui que se esquece.
     *
     * Gravar e ler com a chave errada dão um objeto errado; `list("escolas/")`
     * daria o bucket inteiro, e `deletePrefix("escolas/")` apagaria o de todo
     * mundo. São as duas operações em que o descuido não é um vazamento, é o
     * vazamento.
     */
    async list(prefix_: string, options?: ListOptions) {
      return storage.list(assertWithinTenant(prefix_), options);
    },

    async deletePrefix(prefix_: string) {
      return storage.deletePrefix(assertWithinTenant(prefix_));
    },
  };
}
