import { teacherSubject } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestLesson,
  createTestMembership,
  createTestSchool,
  createTestStudent,
  createTestSubject,
  createTestUser,
} from "../../testing/fixtures";
import { createTeacherInviteService } from "./convite-service";
import { createTeacherInviteLookup, createTeacherRepository } from "./repository";
import { createTeacherService } from "./service";

afterAll(async () => {
  await closeTestDb();
});

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const vincular = (tx: Tx, schoolId: string, userId: string, role: string) =>
  createTestMembership(tx, { schoolId, userId, role });

describe("createTeacherRepository", () => {
  it("lista só quem tem vínculo de professor nesta escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      const secretaria = await createTestUser(tx);

      await vincular(tx, escola.id, professor.id, "teacher");
      await vincular(tx, escola.id, secretaria.id, "admin");

      const lista = await createTeacherRepository(tx, { schoolId: escola.id }).list();

      expect(lista.map((l) => l.userId)).toEqual([professor.id]);
    });
  });

  /** O vínculo é por escola: o mesmo usuário não vaza de uma para a outra. */
  it("não enxerga docente de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const professor = await createTestUser(tx);

      await vincular(tx, a.id, professor.id, "teacher");

      const daOutra = createTeacherRepository(tx, { schoolId: b.id });
      expect(await daOutra.list()).toEqual([]);
      expect(await daOutra.findMember(professor.id)).toBeNull();
    });
  });

  it("conta turmas, disciplinas e aulas do ano, e ignora outro ano", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const turmaA = await createTestClassroom(tx, escola.id, "8º A");
      const turmaB = await createTestClassroom(tx, escola.id, "9º B");
      const matematica = await createTestSubject(tx, escola.id, "Matemática");

      for (const [turma, data] of [
        [turmaA, "2026-03-02"],
        [turmaA, "2026-03-03"],
        [turmaB, "2026-03-04"],
        [turmaA, "2025-03-02"],
      ] as const) {
        await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: matematica.id,
          teacherId: professor.id,
          date: data,
        });
      }

      const [carga] = await createTeacherRepository(tx, { schoolId: escola.id }).loadByTeacher(
        2026,
      );

      expect(carga).toMatchObject({ turmas: 2, disciplinas: 1, aulas: 3 });
    });
  });

  /**
   * Aula de hoje ainda pode ser registrada até o fim do dia — é o prazo da
   * tela de chamada. Cobrar antes seria acusar de atraso quem está no prazo.
   */
  it("só cobra chamada de aula anterior a hoje", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const turma = await createTestClassroom(tx, escola.id);
      const disciplina = await createTestSubject(tx, escola.id);

      for (const data of ["2026-03-02", "2026-03-10"]) {
        await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          date: data,
        });
      }

      const repo = createTeacherRepository(tx, { schoolId: escola.id });
      const [pendentes] = await repo.pendingCallsByTeacher(2026, "2026-03-10");

      expect(pendentes?.pendentes).toBe(1);
    });
  });

  it("conta os alunos alcançados sem repetir quem está em duas turmas", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const turma = await createTestClassroom(tx, escola.id);
      const disciplina = await createTestSubject(tx, escola.id);
      const outra = await createTestSubject(tx, escola.id, "Física");

      await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id });
      await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id });
      // Aluno inativo não conta: ele não está na sala.
      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        status: "inativo",
      });

      // Duas disciplinas na mesma turma não dobram a contagem de alunos.
      for (const materia of [disciplina, outra]) {
        await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: materia.id,
          teacherId: professor.id,
          date: "2026-03-02",
        });
      }

      const alunos = await createTeacherRepository(tx, { schoolId: escola.id }).reachOf(
        professor.id,
        2026,
      );

      expect(alunos).toBe(2);
    });
  });

  it("acha o docente por id e traz nome e e-mail", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const achado = await createTeacherRepository(tx, { schoolId: escola.id }).findMember(
        professor.id,
      );

      expect(achado?.userId).toBe(professor.id);
      expect(achado?.email).toBeTruthy();
    });
  });
});

describe("pendingGradesByTeacher", () => {
  /**
   * Este método só quebrava ao rodar de verdade: a subconsulta usava campos
   * agregados sem `.as()`, o que o TypeScript aceita e o Drizzle recusa em
   * tempo de execução. Dublê em memória não pega isso — só Postgres pega.
   */
  it("conta aluno na sala sem nota lançada", async () => {
    await withRollback(async (tx) => {
      const { assessment, grade } = await import("@educa-escola/db/schema");

      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const turma = await createTestClassroom(tx, escola.id);
      const disciplina = await createTestSubject(tx, escola.id);

      const alunos = [
        await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id }),
        await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id }),
        await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id }),
      ];

      const [avaliacao] = await tx
        .insert(assessment)
        .values({
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          name: "Prova 1",
          term: 1,
        })
        .returning({ id: assessment.id });

      // Um dos três tem nota: faltam dois lançamentos.
      await tx.insert(grade).values({
        schoolId: escola.id,
        assessmentId: (avaliacao as { id: string }).id,
        studentId: alunos[0]?.id as string,
        score: 8,
      });

      const [linha] = await createTeacherRepository(tx, {
        schoolId: escola.id,
      }).pendingGradesByTeacher(new Date().getFullYear());

      expect(linha).toMatchObject({ teacherId: professor.id, faltando: 2 });
    });
  });

  it("não conta aluno inativo como pendência", async () => {
    await withRollback(async (tx) => {
      const { assessment } = await import("@educa-escola/db/schema");

      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      await vincular(tx, escola.id, professor.id, "teacher");

      const turma = await createTestClassroom(tx, escola.id);
      const disciplina = await createTestSubject(tx, escola.id);

      await createTestStudent(tx, { schoolId: escola.id, classroomId: turma.id });
      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        status: "transferido",
      });

      await tx.insert(assessment).values({
        schoolId: escola.id,
        classroomId: turma.id,
        subjectId: disciplina.id,
        teacherId: professor.id,
        name: "Prova 1",
        term: 1,
      });

      const [linha] = await createTeacherRepository(tx, {
        schoolId: escola.id,
      }).pendingGradesByTeacher(new Date().getFullYear());

      expect(linha?.faltando).toBe(1);
    });
  });
});

describe("convite de professor", () => {
  async function cenario(tx: Tx, nome = "Escola A") {
    const escola = await createTestSchool(tx, nome);
    const operador = await createTestUser(tx);
    await createTestMembership(tx, { schoolId: escola.id, userId: operador.id, role: "owner" });
    return { escola, operador, repo: createTeacherRepository(tx, { schoolId: escola.id }) };
  }

  function servicoDoConvite(tx: Tx, contas: { userId: string }[] = []) {
    return createTeacherInviteService({
      now: () => new Date(),
      lookup: createTeacherInviteLookup(tx),
      repoFor: (tenant) => createTeacherRepository(tx, tenant),
      criarConta: async () => {
        const conta = contas.shift();
        if (!conta) throw new Error("dublê sem conta preparada");
        return conta;
      },
    });
  }

  const tokenDe = (url: string) => url.split("/").at(-1) as string;

  function servico(tx: Tx, schoolId: string, actorUserId: string) {
    return createTeacherService(createTeacherRepository(tx, { schoolId }), {
      now: () => new Date(),
      linkBaseUrl: "http://localhost:3001",
      actor: { userId: actorUserId },
      criarConta: async () => ({ userId: "não usado aqui" }),
    });
  }

  /**
   * O caminho inteiro: a secretaria cadastra, o professor abre o link, cria a
   * senha e vira membro da escola.
   */
  it("o professor nasce do aceite, com vínculo e habilitação", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const disciplina = await createTestSubject(tx, c.escola.id, "Matemática");
      const futuro = await createTestUser(tx);

      const convite = await servico(tx, c.escola.id, c.operador.id).convidar({
        name: "Ricardo Alves",
        email: "Ricardo.Alves@Escola.br",
        subjectIds: [disciplina.id],
        expiryDays: 7,
      });

      // O e-mail é normalizado: "Ricardo.Alves@" e "ricardo.alves@" são a
      // mesma pessoa para qualquer provedor, e duas linhas seriam dois acessos.
      expect(convite.email).toBe("ricardo.alves@escola.br");

      const aberto = await servicoDoConvite(tx).abrir(tokenDe(convite.url));
      expect(aberto.nome).toBe("Ricardo Alves");
      expect(aberto.escola).toBe("Escola A");

      await servicoDoConvite(tx, [{ userId: futuro.id }]).aceitar({
        token: tokenDe(convite.url),
        password: "uma-senha-forte",
      });

      const docentes = await c.repo.list();
      expect(docentes.map((d) => d.userId)).toContain(futuro.id);

      const habilitacoes = await tx
        .select()
        .from(teacherSubject)
        .where(eq(teacherSubject.userId, futuro.id));
      expect(habilitacoes).toHaveLength(1);
    });
  });

  /** Dois cliques no mesmo link não criam dois vínculos. */
  it("o convite só é aceito uma vez", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const a = await createTestUser(tx);
      const b = await createTestUser(tx);

      const convite = await servico(tx, c.escola.id, c.operador.id).convidar({
        name: "Sérgio Bandeira",
        email: "sergio@escola.br",
        subjectIds: [],
        expiryDays: 7,
      });

      await servicoDoConvite(tx, [{ userId: a.id }]).aceitar({
        token: tokenDe(convite.url),
        password: "uma-senha-forte",
      });

      await expect(
        servicoDoConvite(tx, [{ userId: b.id }]).aceitar({
          token: tokenDe(convite.url),
          password: "outra-senha-forte",
        }),
      ).rejects.toThrow();
    });
  });

  /** Emitir de novo revoga o anterior: dois links vivos confundem os dois lados. */
  it("um convite vivo por e-mail", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const s = servico(tx, c.escola.id, c.operador.id);

      const primeiro = await s.convidar({
        name: "Helena Diniz",
        email: "helena@escola.br",
        subjectIds: [],
        expiryDays: 7,
      });
      const segundo = await s.convidar({
        name: "Helena Diniz",
        email: "helena@escola.br",
        subjectIds: [],
        expiryDays: 7,
      });

      await expect(servicoDoConvite(tx).abrir(tokenDe(primeiro.url))).rejects.toThrow(
        /não vale mais/i,
      );
      await expect(servicoDoConvite(tx).abrir(tokenDe(segundo.url))).resolves.toBeTruthy();
    });
  });

  it("recusa cadastrar quem já tem acesso à escola", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const existente = await createTestUser(tx, "ja.tem@escola.br");
      await createTestMembership(tx, {
        schoolId: c.escola.id,
        userId: existente.id,
        role: "teacher",
      });

      await expect(
        servico(tx, c.escola.id, c.operador.id).convidar({
          name: "Já Tem",
          email: "ja.tem@escola.br",
          subjectIds: [],
          expiryDays: 7,
        }),
      ).rejects.toThrow(/já tem acesso/i);
    });
  });

  /** Token desconhecido responde igual a token vencido: não dá para enumerar. */
  it("token desconhecido não revela nada", async () => {
    await withRollback(async (tx) => {
      await expect(servicoDoConvite(tx).abrir("token-que-nao-existe-0000000")).rejects.toThrow(
        /não existe ou já foi usado/i,
      );
    });
  });
});
