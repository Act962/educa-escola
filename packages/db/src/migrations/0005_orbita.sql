CREATE TYPE "public"."orbita_event_type" AS ENUM('conectada', 'desconectada', 'instalacao_iniciada', 'instalado', 'instalacao_falhou', 'removido');--> statement-breakpoint
CREATE TYPE "public"."orbita_install_status" AS ENUM('instalando', 'instalado', 'falhou', 'removido');--> statement-breakpoint
CREATE TYPE "public"."orbita_workspace_status" AS ENUM('pendente', 'ativo', 'suspenso');--> statement-breakpoint
CREATE TABLE "orbita_app_install" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"app_key" text NOT NULL,
	"status" "orbita_install_status" DEFAULT 'instalando' NOT NULL,
	"setup_cost_snapshot" integer,
	"monthly_cost_snapshot" integer,
	"installed_at" timestamp,
	"installed_by_user_id" text,
	"removed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orbita_event" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"type" "orbita_event_type" NOT NULL,
	"app_key" text,
	"actor_user_id" text,
	"payload" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orbita_workspace" (
	"school_id" text PRIMARY KEY NOT NULL,
	"orbita_organization_id" text,
	"status" "orbita_workspace_status" DEFAULT 'pendente' NOT NULL,
	"connected_at" timestamp,
	"connected_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orbita_app_install" ADD CONSTRAINT "orbita_app_install_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbita_app_install" ADD CONSTRAINT "orbita_app_install_installed_by_user_id_user_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbita_event" ADD CONSTRAINT "orbita_event_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbita_event" ADD CONSTRAINT "orbita_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbita_workspace" ADD CONSTRAINT "orbita_workspace_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orbita_workspace" ADD CONSTRAINT "orbita_workspace_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orbita_app_install_school_app_uidx" ON "orbita_app_install" USING btree ("school_id","app_key");--> statement-breakpoint
CREATE INDEX "orbita_app_install_school_idx" ON "orbita_app_install" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "orbita_event_school_idx" ON "orbita_event" USING btree ("school_id","occurred_at");