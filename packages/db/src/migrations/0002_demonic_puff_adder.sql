CREATE TYPE "public"."consent_purpose" AS ENUM('termos_matricula', 'uso_imagem', 'comunicacao');--> statement-breakpoint
CREATE TYPE "public"."enrollment_actor" AS ENUM('gestao', 'responsavel', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."enrollment_event_type" AS ENUM('criada', 'link_gerado', 'link_enviado', 'link_revogado', 'conferencia_ok', 'conferencia_falha', 'ficha_enviada', 'confirmada', 'cancelada', 'renovada', 'expirada');--> statement-breakpoint
CREATE TYPE "public"."enrollment_kind" AS ENUM('matricula', 'rematricula');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pendente', 'ativa', 'suspensa', 'cancelada', 'transferida', 'concluida');--> statement-breakpoint
CREATE TYPE "public"."guardian_relationship" AS ENUM('mae', 'pai', 'avo', 'responsavel_legal', 'outro');--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"academic_year" integer NOT NULL,
	"classroom_id" text,
	"shift" text DEFAULT 'manha' NOT NULL,
	"status" "enrollment_status" DEFAULT 'pendente' NOT NULL,
	"kind" "enrollment_kind" DEFAULT 'matricula' NOT NULL,
	"previous_enrollment_id" text,
	"expires_at" timestamp,
	"confirmed_at" timestamp,
	"effective_on" date,
	"cancel_reason" text,
	"cancelled_on" date,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"term_version" text NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"actor_name" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"type" "enrollment_event_type" NOT NULL,
	"actor" "enrollment_actor" NOT NULL,
	"actor_user_id" text,
	"payload" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_guardian" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"name" text NOT NULL,
	"relationship" "guardian_relationship" DEFAULT 'responsavel_legal' NOT NULL,
	"phone_e164" text NOT NULL,
	"email" text,
	"is_legal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"consumed_at" timestamp,
	"revoked_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"locked_at" timestamp,
	"recipient_phone" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD CONSTRAINT "enrollment_consent_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD CONSTRAINT "enrollment_consent_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_event" ADD CONSTRAINT "enrollment_event_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_event" ADD CONSTRAINT "enrollment_event_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_event" ADD CONSTRAINT "enrollment_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_guardian" ADD CONSTRAINT "enrollment_guardian_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_guardian" ADD CONSTRAINT "enrollment_guardian_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_invite" ADD CONSTRAINT "enrollment_invite_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_invite" ADD CONSTRAINT "enrollment_invite_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_invite" ADD CONSTRAINT "enrollment_invite_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_school_year_idx" ON "enrollment" USING btree ("school_id","academic_year");--> statement-breakpoint
CREATE INDEX "enrollment_student_idx" ON "enrollment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enrollment_school_status_idx" ON "enrollment" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_student_year_active_uidx" ON "enrollment" USING btree ("school_id","student_id","academic_year") WHERE status = 'ativa';--> statement-breakpoint
CREATE INDEX "enrollment_consent_enrollment_idx" ON "enrollment_consent" USING btree ("enrollment_id","purpose");--> statement-breakpoint
CREATE INDEX "enrollment_event_enrollment_idx" ON "enrollment_event" USING btree ("school_id","enrollment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "enrollment_guardian_enrollment_idx" ON "enrollment_guardian" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "enrollment_guardian_school_phone_idx" ON "enrollment_guardian" USING btree ("school_id","phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_invite_token_hash_uidx" ON "enrollment_invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "enrollment_invite_enrollment_idx" ON "enrollment_invite" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "enrollment_invite_school_idx" ON "enrollment_invite" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "enrollment_invite_expires_idx" ON "enrollment_invite" USING btree ("expires_at");