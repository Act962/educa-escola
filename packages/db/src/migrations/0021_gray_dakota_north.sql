CREATE TABLE "teacher_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"subject_ids" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"revoked_at" timestamp,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_subject" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_invite" ADD CONSTRAINT "teacher_invite_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_invite" ADD CONSTRAINT "teacher_invite_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject" ADD CONSTRAINT "teacher_subject_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject" ADD CONSTRAINT "teacher_subject_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject" ADD CONSTRAINT "teacher_subject_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_invite_token_hash_uidx" ON "teacher_invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "teacher_invite_school_idx" ON "teacher_invite" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_subject_uidx" ON "teacher_subject" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "teacher_subject_school_idx" ON "teacher_subject" USING btree ("school_id","subject_id");