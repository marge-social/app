CREATE TYPE "public"."notification_channel" AS ENUM('realtime', 'digest', 'off');--> statement-breakpoint
CREATE TYPE "public"."notification_scope" AS ENUM('all', 'local', 'federated');--> statement-breakpoint
CREATE TABLE "digest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"origin" text DEFAULT 'local' NOT NULL,
	"actor_uri" text NOT NULL,
	"actor_handle" text NOT NULL,
	"actor_name" text,
	"actor_icon_url" text,
	"object_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"digested_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"scope" "notification_scope" NOT NULL,
	CONSTRAINT "notification_settings_user_type_unq" UNIQUE("user_id","type")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "group_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digest_items_pending_idx" ON "digest_items" USING btree ("recipient_user_id","digested_at");