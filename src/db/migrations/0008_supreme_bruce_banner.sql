CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio', 'pdf');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_key" text,
	"thumbnail_url" text,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"post_id" uuid,
	"article_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remote_objects" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_media_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_post_idx" ON "media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "media_article_idx" ON "media" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;