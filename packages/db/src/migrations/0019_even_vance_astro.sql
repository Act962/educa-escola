CREATE TYPE "public"."consent_origin" AS ENUM('link', 'presencial');--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD COLUMN "origin" "consent_origin" DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD COLUMN "registered_by_user_id" text;--> statement-breakpoint
ALTER TABLE "enrollment_consent" ADD CONSTRAINT "enrollment_consent_registered_by_user_id_user_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;