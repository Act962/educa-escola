CREATE TYPE "public"."gate_direction" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TYPE "public"."gate_method" AS ENUM('rosto', 'carteirinha', 'manual');--> statement-breakpoint
CREATE TABLE "school_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"direction" "gate_direction" NOT NULL,
	"method" "gate_method" NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"operator_user_id" text,
	"device_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_face_template" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"cipher" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"dimensions" integer NOT NULL,
	"extractor" text NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"enrolled_by_user_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_entry" ADD CONSTRAINT "school_entry_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_entry" ADD CONSTRAINT "school_entry_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_entry" ADD CONSTRAINT "school_entry_operator_user_id_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_face_template" ADD CONSTRAINT "student_face_template_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_face_template" ADD CONSTRAINT "student_face_template_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_face_template" ADD CONSTRAINT "student_face_template_enrolled_by_user_id_user_id_fk" FOREIGN KEY ("enrolled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "school_entry_school_at_idx" ON "school_entry" USING btree ("school_id","occurred_at");--> statement-breakpoint
CREATE INDEX "school_entry_student_idx" ON "school_entry" USING btree ("school_id","student_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_face_template_student_uidx" ON "student_face_template" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_face_template_school_idx" ON "student_face_template" USING btree ("school_id");