CREATE TYPE "public"."onboarding_item_type" AS ENUM('marge', 'fediverse', 'rss', 'youtube');--> statement-breakpoint
CREATE TABLE "onboarding_pack_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"type" "onboarding_item_type" NOT NULL,
	"label" text NOT NULL,
	"ref" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_pack_items" ADD CONSTRAINT "onboarding_pack_items_pack_id_onboarding_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."onboarding_packs"("id") ON DELETE cascade ON UPDATE no action;