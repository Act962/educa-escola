CREATE TYPE "public"."referral_referer_kind" AS ENUM('responsavel', 'aluno', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."referral_reward_kind" AS ENUM('percentual', 'valor');--> statement-breakpoint
CREATE TABLE "referral_conversion" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"link_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"reward_kind" "referral_reward_kind" NOT NULL,
	"reward_value" integer NOT NULL,
	"note" text,
	"registered_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_link" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"code" text NOT NULL,
	"created_by_user_id" text,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_program" (
	"school_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"headline" text DEFAULT 'Indique e ganhe desconto' NOT NULL,
	"description" text,
	"terms" text,
	"reward_kind" "referral_reward_kind" DEFAULT 'percentual' NOT NULL,
	"reward_value" integer DEFAULT 10 NOT NULL,
	"reward_cap_per_year" integer DEFAULT 3 NOT NULL,
	"link_expires_in_days" integer DEFAULT 90 NOT NULL,
	"who_can_refer" "referral_referer_kind" DEFAULT 'responsavel' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_link_id_referral_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."referral_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversion" ADD CONSTRAINT "referral_conversion_registered_by_user_id_user_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_link" ADD CONSTRAINT "referral_link_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_link" ADD CONSTRAINT "referral_link_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_link" ADD CONSTRAINT "referral_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_program" ADD CONSTRAINT "referral_program_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_conversion_enrollment_uidx" ON "referral_conversion" USING btree ("school_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "referral_conversion_link_idx" ON "referral_conversion" USING btree ("link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_link_code_uidx" ON "referral_link" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_link_student_uidx" ON "referral_link" USING btree ("school_id","student_id");