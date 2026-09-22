import { describe, expect, it } from "vitest";

import { dispositivoDe } from "./dispositivo";

describe("dispositivoDe", () => {
  /**
   * O caso que quebra se a ordem dos testes mudar: Chrome e Edge escrevem
   * "Safari" no próprio user-agent, e um `includes("Safari")` cedo demais
   * marcaria as duas sessões como Safari — o usuário encerraria a errada.
   */
  it("não confunde Chrome e Edge com Safari", () => {
    expect(
      dispositivoDe(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome no macOS");

    expect(
      dispositivoDe(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      ),
    ).toBe("Edge no Windows");
  });

  it("reconhece Safari de verdade", () => {
    expect(
      dispositivoDe(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari no iOS");
  });

  it("reconhece Firefox no Linux", () => {
    expect(
      dispositivoDe("Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0"),
    ).toBe("Firefox no Linux");
  });

  /** Sessão antiga pode não ter user-agent. Não é erro, é "não sei". */
  it("não inventa dispositivo quando não há user-agent", () => {
    expect(dispositivoDe(null)).toBe("Dispositivo desconhecido");
    expect(dispositivoDe("")).toBe("Dispositivo desconhecido");
    expect(dispositivoDe("   ")).toBe("Dispositivo desconhecido");
    expect(dispositivoDe("curl/8.7.1")).toBe("Dispositivo desconhecido");
  });

  it("dá o sistema quando só ele é reconhecível", () => {
    expect(dispositivoDe("MeuApp/1.0 (Android 15)")).toBe("Android");
  });
});
