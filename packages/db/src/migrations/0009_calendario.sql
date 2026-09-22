CREATE TYPE "public"."calendar_event_type" AS ENUM('feriado', 'recesso', 'ferias', 'evento', 'reuniao', 'conselho', 'avaliacao', 'reposicao', 'prazo');--> statement-breakpoint
CREATE TYPE "public"."calendar_scope" AS ENUM('institucional', 'segmento', 'turma');--> statement-breakpoint
CREATE TYPE "public"."day_effect" AS ENUM('nenhum', 'nao_letivo', 'letivo_extra');--> statement-breakpoint
CREATE TABLE "academic_calendar" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"minimum_school_days" integer DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"scope" "calendar_scope" DEFAULT 'institucional' NOT NULL,
	"stage" "stage",
	"classroom_id" text,
	"type" "calendar_event_type" NOT NULL,
	"day_effect" "day_effect" DEFAULT 'nenhum' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"all_day" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_calendar_ano_uidx" ON "academic_calendar" USING btree ("school_id","academic_year");--> statement-breakpoint
CREATE INDEX "calendar_event_ano_idx" ON "calendar_event" USING btree ("school_id","academic_year","starts_on");--> statement-breakpoint
CREATE INDEX "calendar_event_turma_idx" ON "calendar_event" USING btree ("classroom_id");