ALTER TABLE "decks" ADD COLUMN "forked_from_deck_id" uuid;--> statement-breakpoint
ALTER TABLE "decks" ADD COLUMN "forked_from_user_id" text;--> statement-breakpoint
ALTER TABLE "errata" ADD COLUMN "resolved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "community_deck_idx" ON "community_posts" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "errata_item_idx" ON "errata" USING btree ("item_id");