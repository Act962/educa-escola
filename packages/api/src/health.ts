export type HealthReport = {
  status: "ok" | "indisponivel";
  checks: { database: "ok" | "falhou" };
};

/**
 * O que o orquestrador (Coolify) e o monitor de uptime perguntam: este
 * container consegue atender?
 *
 * A resposta é deliberadamente pobre. A rota é pública — o healthcheck não
 * tem sessão — então a mensagem de erro do driver, que pode trazer host,
 * usuário e nome do banco, vai só para o log do servidor, nunca para o corpo.
 *
 * Recebe o ping por parâmetro para ser testável sem banco, como os services.
 */
export async function checkHealth(
  ping: () => Promise<void>,
  log: (message: string, error: unknown) => void = console.error,
): Promise<HealthReport> {
  try {
    await ping();
    return { status: "ok", checks: { database: "ok" } };
  } catch (error) {
    log("[health] banco indisponível:", error);
    return { status: "indisponivel", checks: { database: "falhou" } };
  }
}
