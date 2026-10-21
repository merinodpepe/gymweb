CREATE TABLE "google_auth" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"refresh_token_sealed" text NOT NULL,
	"scope" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	CONSTRAINT "google_auth_single" CHECK ("google_auth"."id" = 1)
);
