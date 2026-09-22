import { checkHealth } from "@educa-escola/api/health";
import { db } from "@educa-escola/db";
import { pingDatabase } from "@educa-escola/db/health";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Healthcheck do container e do monitor de uptime.
 *
 * Existe porque o healthcheck antigo batia em `/`, que redireciona para
 * `/login` e responde 200 mesmo com o banco fora — o Coolify promoveria um
 * container incapaz de atender. Aqui, banco fora é 503.
 */
async function GET() {
  const report = await checkHealth(() => pingDatabase(db));

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    // Proxy ou CDN no caminho não pode guardar a resposta de um minuto atrás.
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: { GET },
  },
});
