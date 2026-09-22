CREATE TYPE "public"."subject_kind" AS ENUM('obrigatoria', 'eletiva', 'complementar');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('infantil', 'fundamental_i', 'fundamental_ii', 'medio');--> statement-breakpoint
CREATE TABLE "curriculum" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"stage" "stage" NOT NULL,
	"grade_level" integer NOT NULL,
	"subject_id" text NOT NULL,
	"weekly_hours" integer DEFAULT 1 NOT NULL,
	"annual_hours" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "kind" "subject_kind" DEFAULT 'obrigatoria' NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "composes_average" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "tracks_attendance" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "stage" "stage";--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "grade_level" integer;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_serie_disciplina_uidx" ON "curriculum" USING btree ("school_id","academic_year","stage","grade_level","subject_id");--> statement-breakpoint
CREATE INDEX "curriculum_serie_idx" ON "curriculum" USING btree ("school_id","academic_year","stage");--> statement-breakpoint
-- Preenche série e segmento a partir do nome da turma.
--
-- Não é adivinhação: é exatamente a mesma leitura que `classCodeOf` já fazia
-- em tempo de execução desde a matrícula ("8º A" -> série 8). A migration só
-- persiste o que o app já derivava, para a coluna nascer útil em vez de vazia.
--
-- Turma cujo nome não começa com número fica nula, que é a resposta certa:
-- "Berçário II" não tem série numérica, e inventar uma viraria relatório
-- errado. O corte 1-5 / 6-9 é o padrão da educação básica brasileira; escola
-- que organize diferente ajusta na tela, que é onde essa decisão pertence.
UPDATE "classroom"
SET "grade_level" = (substring("name" from '^[0-9]+'))::integer,
    "stage" = CASE
      WHEN (substring("name" from '^[0-9]+'))::integer BETWEEN 1 AND 5 THEN 'fundamental_i'::"stage"
      WHEN (substring("name" from '^[0-9]+'))::integer BETWEEN 6 AND 9 THEN 'fundamental_ii'::"stage"
      ELSE NULL
    END
WHERE "grade_level" IS NULL
  AND "name" ~ '^[0-9]+';
