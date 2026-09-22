CREATE TYPE "public"."leaderboard_status" AS ENUM('ativa', 'suspensa');--> statement-breakpoint
CREATE TABLE "school_leaderboard_entry" (
	"school_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"academic_year" integer NOT NULL,
	"points" integer NOT NULL,
	"chamada_no_prazo" integer NOT NULL,
	"notas_sem_pendencia" integer NOT NULL,
	"frequencia_media" integer NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_leaderboard_opt_in" (
	"school_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"status" "leaderboard_status" DEFAULT 'ativa' NOT NULL,
	"academic_year" integer NOT NULL,
	"opted_in_at" timestamp DEFAULT now() NOT NULL,
	"opted_in_by_user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_leaderboard_entry" ADD CONSTRAINT "school_leaderboard_entry_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_leaderboard_opt_in" ADD CONSTRAINT "school_leaderboard_opt_in_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leaderboard_entry_ano_idx" ON "school_leaderboard_entry" USING btree ("academic_year","points");--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_opt_in_school_uidx" ON "school_leaderboard_opt_in" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "leaderboard_opt_in_ano_idx" ON "school_leaderboard_opt_in" USING btree ("academic_year","status");