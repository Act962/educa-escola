ALTER TABLE "school_entry" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "school_entry" ADD COLUMN "deleted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "school_entry" ADD CONSTRAINT "school_entry_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;