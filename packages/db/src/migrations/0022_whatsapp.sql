CREATE TYPE "public"."whatsapp_account_status" AS ENUM('rascunho', 'conectado', 'erro');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_billing_category" AS ENUM('servico', 'modelo');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('fila', 'enviado', 'entregue', 'lido', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_provider" AS ENUM('cloud', 'memoria');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template_category" AS ENUM('UTILITY', 'MARKETING', 'AUTHENTICATION');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_template_status" AS ENUM('rascunho', 'enviado', 'aprovado', 'recusado', 'pausado');--> statement-breakpoint
CREATE TABLE "whatsapp_account" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"provider" "whatsapp_provider" DEFAULT 'cloud' NOT NULL,
	"label" text NOT NULL,
	"phone_number_id" text,
	"waba_id" text,
	"app_id" text,
	"display_phone_number" text,
	"verified_name" text,
	"quality_rating" text,
	"token_cipher" text,
	"token_iv" text,
	"token_tag" text,
	"token_hint" text,
	"app_secret_cipher" text,
	"app_secret_iv" text,
	"app_secret_tag" text,
	"status" "whatsapp_account_status" DEFAULT 'rascunho' NOT NULL,
	"last_error" text,
	"checked_at" timestamp,
	"is_default" boolean DEFAULT false NOT NULL,
	"free_tier_limit" integer,
	"block_when_exhausted" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"account_id" text,
	"template_id" text,
	"to_phone_e164" text NOT NULL,
	"kind" text NOT NULL,
	"rendered_text" text NOT NULL,
	"status" "whatsapp_message_status" DEFAULT 'fila' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"billing_category" "whatsapp_billing_category" DEFAULT 'modelo' NOT NULL,
	"opened_conversation" boolean DEFAULT false NOT NULL,
	"sent_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "whatsapp_template" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"account_id" text,
	"name" text NOT NULL,
	"category" "whatsapp_template_category" DEFAULT 'UTILITY' NOT NULL,
	"language" text DEFAULT 'pt_BR' NOT NULL,
	"header_text" text,
	"body" text NOT NULL,
	"footer_text" text,
	"buttons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "whatsapp_template_status" DEFAULT 'rascunho' NOT NULL,
	"provider_template_id" text,
	"rejection_reason" text,
	"synced_at" timestamp,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD CONSTRAINT "whatsapp_account_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD CONSTRAINT "whatsapp_account_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_template_id_whatsapp_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_sent_by_user_id_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template" ADD CONSTRAINT "whatsapp_template_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template" ADD CONSTRAINT "whatsapp_template_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template" ADD CONSTRAINT "whatsapp_template_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_account_school_idx" ON "whatsapp_account" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_account_default_idx" ON "whatsapp_account" USING btree ("school_id") WHERE is_default;--> statement-breakpoint
CREATE INDEX "whatsapp_message_school_at_idx" ON "whatsapp_message" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_message_janela_idx" ON "whatsapp_message" USING btree ("account_id","to_phone_e164","billing_category","sent_at");--> statement-breakpoint
CREATE INDEX "whatsapp_template_school_idx" ON "whatsapp_template" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_template_school_name_idx" ON "whatsapp_template" USING btree ("school_id","name","language");