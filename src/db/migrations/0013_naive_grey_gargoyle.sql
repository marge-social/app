CREATE TABLE "storage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_size_bytes" bigint NOT NULL,
	"table_sizes" jsonb NOT NULL,
	"media_bytes" bigint NOT NULL,
	"disk_total_bytes" bigint,
	"disk_free_bytes" bigint
);
--> statement-breakpoint
CREATE INDEX "storage_snapshots_captured_idx" ON "storage_snapshots" USING btree ("captured_at" DESC NULLS LAST);