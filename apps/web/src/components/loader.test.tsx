import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loader from "@/components/loader";

/**
 * Fumaça do ambiente de componentes: valida jsdom, o plugin do React, os
 * matchers do jest-dom e o alias `@/` de uma vez só. Se este teste quebrar,
 * o problema é de configuração, não do componente.
 */
describe("Loader", () => {
  it("renderiza o indicador de carregamento", () => {
    const { container } = render(<Loader />);

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("animate-spin");
  });

  it("não expõe texto para leitores de tela ainda", () => {
    render(<Loader />);
    // Registra o estado atual: quando adicionarmos rótulo acessível,
    // este teste deve ser atualizado junto.
    expect(screen.queryByRole("status")).toBeNull();
  });
});
