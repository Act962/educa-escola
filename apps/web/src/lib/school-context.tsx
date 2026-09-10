import { createContext, useContext, useMemo, useState } from "react";

export const TERMS = [1, 2, 3, 4] as const;
export type Term = (typeof TERMS)[number];

interface SchoolContextValue {
  year: number;
  term: Term;
  setTerm: (term: Term) => void;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

/**
 * Ano letivo e bimestre ativos.
 *
 * Vive acima de todas as telas porque **toda** consulta é recortada por ele:
 * nota, frequência e fechamento são sempre "de um bimestre". Deixar cada tela
 * com o próprio seletor é como um professor lança nota no bimestre errado.
 */
export function SchoolProvider({
  children,
  year,
  initialTerm = 3,
}: {
  children: React.ReactNode;
  year: number;
  initialTerm?: Term;
}) {
  const [term, setTerm] = useState<Term>(initialTerm);
  const value = useMemo(() => ({ year, term, setTerm }), [year, term]);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchoolContext(): SchoolContextValue {
  const value = useContext(SchoolContext);
  if (!value) throw new Error("useSchoolContext precisa estar dentro de SchoolProvider");
  return value;
}
