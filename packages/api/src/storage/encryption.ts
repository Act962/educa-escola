import { decryptEnvelope, ENVELOPE_SIZE, encryptToEnvelope, parseKey } from "../media/crypto";
import type {
  ListOptions,
  ObjectContent,
  ObjectHead,
  ObjectStorage,
  PutInput,
  PutResult,
} from "./port";
import { validateBody } from "./port";

/**
 * Cifra o corpo antes de gravar e decifra depois de ler.
 *
 * Embrulha qualquer `ObjectStorage`, então vale igual em memória e no R2 — e a
 * suíte prova isso contra o adaptador de memória sem precisar de rede.
 *
 * A ameaça que isto endereça é a mesma da foto no banco: não é invadirem o
 * datacenter da Cloudflare, é a credencial do R2 vazar, e ela vai viver no
 * mesmo `.env` que a `DATABASE_URL`. Cifragem do provedor protege o disco dele;
 * esta protege contra a credencial. Um bucket copiado inteiro, sem a chave,
 * devolve ruído.
 *
 * **Quem decide se cifra é o módulo consumidor, na montagem.** Foto, laudo e
 * boletim, sim; logotipo e material de aula, não — cifrar o que é público custa
 * CPU e tira o proveito de qualquer cache futuro sem proteger nada.
 */
export function createEncryptedStorage(
  storage: ObjectStorage,
  keyBase64: string | undefined,
): ObjectStorage {
  /**
   * A chave é resolvida a cada operação, e não uma vez na construção.
   *
   * Assim montar o serviço nunca falha por falta de chave: quem tenta
   * **gravar** é que recebe a instrução de como gerar. É o comportamento que a
   * foto já tem, e a razão é a mesma — arquivo gravado em claro "só desta vez"
   * é o que ninguém descobre até ser tarde.
   */
  const secret = () => parseKey(keyBase64);

  return {
    async put(input: PutInput): Promise<PutResult> {
      // O teto vale para o arquivo do usuário, antes do envelope: recusar aqui
      // é o que faz a mensagem falar do tamanho que ele escolheu.
      validateBody(input.body);

      const plainSize = input.body.length;
      const stored = await storage.put({
        ...input,
        body: encryptToEnvelope(input.body, secret()),
      });

      return { ...stored, size: plainSize };
    },

    async get(key: string): Promise<ObjectContent> {
      const object = await storage.get(key);
      const body = decryptEnvelope(object.body, secret());
      return { ...object, body, size: body.length };
    },

    async head(key: string): Promise<ObjectHead | null> {
      const object = await storage.head(key);
      if (!object) return null;
      // Quem pergunta o tamanho quer o do arquivo, não o do envelope: mostrar
      // 28 bytes a mais faria a tela discordar do que o usuário baixa.
      return { ...object, size: Math.max(0, object.size - ENVELOPE_SIZE) };
    },

    delete: (key: string) => storage.delete(key),
    list: (prefix: string, options?: ListOptions) => storage.list(prefix, options),
    deletePrefix: (prefix: string) => storage.deletePrefix(prefix),
  };
}
