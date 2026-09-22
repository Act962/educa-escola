import {
  attendance,
  classroom,
  enrollment,
  lesson,
  member,
  organization,
  school,
  student,
  subject,
  user,
} from "@educa-escola/db/schema";
import type { TestTransaction } from "@educa-escola/db/testing";

/**
 * Cria uma escola completa (organization + perfil de domínio).
 *
 * Ids aleatórios de propósito: os arquivos de teste rodam em paralelo contra
 * o mesmo banco, cada um na sua transação, e nomes fixos colidiriam nos
 * índices únicos.
 */
export async function createTestSchool(tx: TestTransaction, name = "Escola Teste") {
  const id = crypto.randomUUID();

  await tx.insert(organization).values({
    id,
    name,
    slug: `escola-${id.slice(0, 8)}`,
    createdAt: new Date(),
  });
  await tx.insert(school).values({ id });

  return { id, name };
}

export async function createTestUser(tx: TestTransaction, email?: string) {
  const id = crypto.randomUUID();

  await tx.insert(user).values({
    id,
    name: "Pessoa Teste",
    email: email ?? `teste-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
  });

  return { id };
}

/**
 * Vincula uma pessoa a uma escola com um papel.
 *
 * O corpo docente não é tabela de domínio: é `member` com papel `teacher`.
 * `id` e `createdAt` vêm explícitos porque a tabela é gerada pelo CLI do
 * Better Auth, que os preenche na aplicação — no banco não há default, e
 * omitir qualquer um dos dois falha com violação de not-null.
 */
export async function createTestMembership(
  tx: TestTransaction,
  input: { schoolId: string; userId: string; role?: string },
) {
  const id = crypto.randomUUID();

  await tx.insert(member).values({
    id,
    organizationId: input.schoolId,
    userId: input.userId,
    role: input.role ?? "teacher",
    createdAt: new Date(),
  });

  return { id };
}

export async function createTestClassroom(
  tx: TestTransaction,
  schoolId: string,
  name = "8º A",
  academicYear = 2026,
) {
  const [row] = await tx
    .insert(classroom)
    .values({ schoolId, name, academicYear })
    .returning({ id: classroom.id });
  return { id: (row as { id: string }).id, name };
}

export async function createTestStudent(
  tx: TestTransaction,
  input: {
    schoolId: string;
    classroomId?: string;
    name?: string;
    registration?: string;
    status?: (typeof student.$inferInsert)["status"];
    /** Conta de acesso do aluno. Nem todo aluno tem uma — por isso é opcional. */
    userId?: string;
  },
) {
  const [row] = await tx
    .insert(student)
    .values({
      schoolId: input.schoolId,
      classroomId: input.classroomId ?? null,
      userId: input.userId ?? null,
      name: input.name ?? "Aluno Teste",
      registration: input.registration ?? `M-${crypto.randomUUID().slice(0, 8)}`,
      status: input.status ?? "ativo",
    })
    .returning({ id: student.id, registration: student.registration });
  return row as { id: string; registration: string };
}

/** Matrícula mínima. A situação é o que o programa de indicações deriva. */
export async function createTestEnrollment(
  tx: TestTransaction,
  input: {
    schoolId: string;
    studentId: string;
    academicYear?: number;
    status?: (typeof enrollment.$inferInsert)["status"];
  },
) {
  const [row] = await tx
    .insert(enrollment)
    .values({
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicYear: input.academicYear ?? 2026,
      status: input.status ?? "pendente",
    })
    .returning({ id: enrollment.id });
  return row as { id: string };
}

export async function createTestSubject(
  tx: TestTransaction,
  schoolId: string,
  name = "Matemática",
) {
  const [row] = await tx
    .insert(subject)
    .values({ schoolId, name: `${name} ${crypto.randomUUID().slice(0, 4)}` })
    .returning({ id: subject.id });
  return row as { id: string };
}

export async function createTestLesson(
  tx: TestTransaction,
  input: {
    schoolId: string;
    classroomId: string;
    subjectId: string;
    teacherId: string;
    date?: string;
  },
) {
  const [row] = await tx
    .insert(lesson)
    .values({
      schoolId: input.schoolId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      date: input.date ?? "2026-09-09",
      startsAt: "07:30",
      endsAt: "08:20",
    })
    .returning({ id: lesson.id });
  return row as { id: string };
}

/** Registra presença em bloco, para os testes que dependem de frequência. */
export async function recordTestAttendance(
  tx: TestTransaction,
  schoolId: string,
  lessonId: string,
  entries: { studentId: string; status: "presente" | "falta" | "atraso" }[],
) {
  await tx.insert(attendance).values(entries.map((entry) => ({ schoolId, lessonId, ...entry })));
}
