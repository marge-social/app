CREATE TABLE "site_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text NOT NULL,
	"content_html" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
