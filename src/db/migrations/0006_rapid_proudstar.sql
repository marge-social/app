ALTER TABLE "articles" ADD COLUMN "in_reply_to_uri" text;--> statement-breakpoint
CREATE INDEX "articles_in_reply_to_idx" ON "articles" USING btree ("in_reply_to_uri");