/**
 * Nome legível do dispositivo, a partir do `user-agent` da sessão.
 *
 * A lista de sessões ativas só serve para a pessoa reconhecer **as suas**: sem
 * isso ela lê quatro strings de trezentos caracteres e não encerra nenhuma, com
 * medo de derrubar a própria. Por isso o retorno é grosso de propósito —
 * "Chrome no Windows" basta; a versão do build não ajuda a reconhecer nada.
 *
 * Não é identificação confiável: `user-agent` é texto que o cliente escolhe.
 * Serve de lembrete para quem já sabe, nunca de prova de quem acessou.
 */
export function deviceFrom(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return "Dispositivo desconhecido";

  const ua = userAgent;
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : // Safari precisa vir por último: Chrome e Edge também escrevem "Safari"
            // no próprio user-agent, e testar por ele antes marcaria os dois errado.
            /Safari\//.test(ua)
            ? "Safari"
            : null;

  const sistema = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;

  if (navegador && sistema) return `${navegador} no ${sistema}`;
  if (navegador) return navegador;
  if (sistema) return sistema;
  return "Dispositivo desconhecido";
}
