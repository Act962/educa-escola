ALTER TYPE "public"."consent_purpose" ADD VALUE 'biometria';--> statement-breakpoint
ALTER TYPE "public"."enrollment_event_type" ADD VALUE 'foto_cadastrada';--> statement-breakpoint
ALTER TYPE "public"."enrollment_event_type" ADD VALUE 'foto_revogada';--> statement-breakpoint
ALTER TYPE "public"."enrollment_event_type" ADD VALUE 'foto_aberta';--> statement-breakpoint
CREATE TABLE "student_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"cipher" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"captured_by_user_id" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_photo" ADD CONSTRAINT "student_photo_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_photo" ADD CONSTRAINT "student_photo_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_photo" ADD CONSTRAINT "student_photo_captured_by_user_id_user_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_photo_student_uidx" ON "student_photo" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_photo_school_idx" ON "student_photo" USING btree ("school_id");