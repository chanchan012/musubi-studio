CREATE TABLE "feynman_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"body" text NOT NULL,
	"agent_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "compare_table" jsonb;--> statement-breakpoint
ALTER TABLE "feynman_notes" ADD CONSTRAINT "feynman_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feynman_notes" ADD CONSTRAINT "feynman_notes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feynman_user_item_idx" ON "feynman_notes" USING btree ("user_id","item_id");