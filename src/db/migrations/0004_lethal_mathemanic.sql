CREATE TYPE "public"."interaction_type" AS ENUM('Like', 'Announce', 'Comment', 'Reply');--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "interaction_type" NOT NULL,
	"actor_iri" text NOT NULL,
	"object_iri" text NOT NULL,
	"activity_iri" text,
	"origin" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "interactions_object_idx" ON "interactions" USING btree ("object_iri");--> statement-breakpoint
CREATE INDEX "interactions_actor_idx" ON "interactions" USING btree ("actor_iri");--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_toggle_unq" ON "interactions" USING btree ("type","actor_iri","object_iri") WHERE type in ('Like', 'Announce');