CREATE TYPE "public"."score_subject_kind" AS ENUM('aluno', 'professor', 'escola');--> statement-breakpoint
CREATE TABLE "score_balance" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"subject_kind" "score_subject_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_event" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"subject_kind" "score_subject_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"rule_key" text NOT NULL,
	"points" integer NOT NULL,
	"academic_year" integer NOT NULL,
	"term" integer,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_balance" ADD CONSTRAINT "score_balance_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_event" ADD CONSTRAINT "score_event_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "score_balance_sujeito_uidx" ON "score_balance" USING btree ("school_id","subject_kind","subject_id","academic_year");--> statement-breakpoint
CREATE INDEX "score_balance_placar_idx" ON "score_balance" USING btree ("school_id","subject_kind","academic_year");--> statement-breakpoint
CREATE UNIQUE INDEX "score_event_origem_uidx" ON "score_event" USING btree ("school_id","subject_kind","subject_id","rule_key","source_id");--> statement-breakpoint
CREATE INDEX "score_event_subject_idx" ON "score_event" USING btree ("school_id","subject_kind","subject_id","academic_year");