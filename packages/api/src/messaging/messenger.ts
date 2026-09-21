/**
 * Entrega do link de confirmação ao responsável.
 *
 * A interface existe antes do canal: hoje a secretaria copia o endereço e
 * manda por conta própria; amanhã entra o WhatsApp oficial como outra
 * implementação, sem que service, router ou tela mudem.
 *
 * `delivered: false` não é erro — é o estado honesto de "link pronto, ninguém
 * entregou ainda", que a tela mostra como "link não enviado".
 */
export interface SendLinkInput {
  to: string;
  studentName: string;
  schoolName: string;
  url: string;
  expiresAt: Date;
}

export interface SendLinkResult {
  delivered: boolean;
  /** Frase curta em português, mostrada ao gestor. */
  detail: string;
}

export interface EnrollmentMessenger {
  sendEnrollmentLink(input: SendLinkInput): Promise<SendLinkResult>;
}

/**
 * Implementação atual: não envia nada.
 *
 * Deliberado enquanto a integração não existe. O link é devolvido uma vez a
 * quem criou a matrícula, e é a pessoa da secretaria que o entrega.
 */
export function createManualMessenger(): EnrollmentMessenger {
  return {
    async sendEnrollmentLink() {
      return { delivered: false, detail: "Envio manual: copie o link e mande ao responsável." };
    },
  };
}
