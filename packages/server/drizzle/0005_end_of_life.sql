ALTER TABLE "animals" ADD COLUMN "comfort_ms" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "last_moments_since" bigint;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "died_at" bigint;