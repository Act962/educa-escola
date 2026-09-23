CREATE TYPE "public"."whatsapp_billing_category" AS ENUM('servico', 'modelo');--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD COLUMN "free_tier_limit" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD COLUMN "block_when_exhausted" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD COLUMN "billing_category" "whatsapp_billing_category" DEFAULT 'modelo' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD COLUMN "opened_conversation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_message_janela_idx" ON "whatsapp_message" USING btree ("account_id","to_phone_e164","billing_category","sent_at");