CREATE TYPE "public"."enrollment_invite_purpose" AS ENUM('ficha', 'biometria');--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD COLUMN "invite_id" text;--> statement-breakpoint
ALTER TABLE "enrollment_invite" ADD COLUMN "purpose" "enrollment_invite_purpose" DEFAULT 'ficha' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD CONSTRAINT "enrollment_consent_invite_id_enrollment_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."enrollment_invite"("id") ON DELETE set null ON UPDATE no action;