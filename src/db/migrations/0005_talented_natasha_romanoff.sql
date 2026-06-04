ALTER TYPE "public"."notification_type" ADD VALUE 'comment' BEFORE 'reply';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "in_reply_to_uri" text;--> statement-breakpoint
ALTER TABLE "remote_objects" ADD COLUMN "in_reply_to_uri" text;--> statement-breakpoint
CREATE INDEX "posts_in_reply_to_idx" ON "posts" USING btree ("in_reply_to_uri");--> statement-breakpoint
CREATE INDEX "remote_objects_in_reply_to_idx" ON "remote_objects" USING btree ("in_reply_to_uri");