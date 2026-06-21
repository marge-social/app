CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"verified_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_signups_email_unique" UNIQUE("email"),
	CONSTRAINT "pending_signups_token_hash_unique" UNIQUE("token_hash")
);
