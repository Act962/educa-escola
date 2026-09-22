CREATE TYPE "public"."communication_audience" AS ENUM('toda_a_escola', 'professores', 'alunos', 'turma');--> statement-breakpoint
CREATE TYPE "public"."communication_priority" AS ENUM('normal', 'importante', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."communication_status" AS ENUM('rascunho', 'publicado', 'retificado');--> statement-breakpoint
CREATE TABLE "communication" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" "communication_priority" DEFAULT 'normal' NOT NULL,
	"audience" "communication_audience" DEFAULT 'toda_a_escola' NOT NULL,
	"classroom_id" text,
	"status" "communication_status" DEFAULT 'rascunho' NOT NULL,
	"requires_ack" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"expires_on" timestamp,
	"replaces_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"communication_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication" ADD CONSTRAINT "communication_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_receipt" ADD CONSTRAINT "communication_receipt_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_receipt" ADD CONSTRAINT "communication_receipt_communication_id_communication_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."communication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_receipt" ADD CONSTRAINT "communication_receipt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communication_escola_ano_idx" ON "communication" USING btree ("school_id","academic_year","status");--> statement-breakpoint
CREATE INDEX "communication_turma_idx" ON "communication" USING btree ("classroom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_receipt_uidx" ON "communication_receipt" USING btree ("communication_id","user_id");--> statement-breakpoint
CREATE INDEX "communication_receipt_usuario_idx" ON "communication_receipt" USING btree ("user_id");