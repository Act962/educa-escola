import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateField } from "./date-field";

function montar(props: Partial<Parameters<typeof DateField>[0]> = {}) {
  const onChange = vi.fn();
  render(<DateField id="data" label="Data" value="" onChange={onChange} {...props} />);
  return { onChange, campo: screen.getByLabelText("Data") as HTMLInputElement };
}

describe("DateField", () => {
  it("mostra a data ISO no formato brasileiro", () => {
    const { campo } = montar({ value: "2026-09-07" });
    expect(campo.value).toBe("07/09/2026");
  });

  /** A pessoa digita oito dígitos seguidos; as barras são problema nosso. */
  it("põe as barras sozinho e devolve ISO", () => {
    const { onChange, campo } = montar();

    fireEvent.change(campo, { target: { value: "07092026" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-07");
  });

  it("devolve nulo enquanto a data está incompleta", () => {
    const { onChange, campo } = montar();

    fireEvent.change(campo, { target: { value: "0709" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  /** 31/02 digitado agora e recusado três campos depois esconde o erro. */
  it("avisa na hora que a data não existe", () => {
    const { campo } = montar();

    fireEvent.change(campo, { target: { value: "31022026" } });
    expect(screen.getByText(/não existe no calendário/)).toBeInTheDocument();
  });

  it("avisa quando a data está fora do intervalo permitido", () => {
    montar({ value: "2026-01-05", min: "2026-02-02", max: "2026-12-18" });
    expect(screen.getByText(/entre 02\/02\/2026 e 18\/12\/2026/)).toBeInTheDocument();
  });

  it("mostra a idade quando pedido, para conferência", () => {
    montar({ value: "2015-09-07", mostrarIdade: true });
    expect(screen.getByText(/anos/)).toBeInTheDocument();
  });

  it("não mostra idade quando não é data de nascimento", () => {
    montar({ value: "2026-09-07" });
    expect(screen.queryByText(/anos/)).not.toBeInTheDocument();
  });
});
