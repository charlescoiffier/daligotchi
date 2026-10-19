CREATE TABLE "eggs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"origin" text NOT NULL,
	"household_id" uuid,
	"genotype" jsonb NOT NULL,
	"form" text NOT NULL,
	"warmth" double precision NOT NULL,
	"cleanliness" double precision NOT NULL,
	"progress" double precision NOT NULL,
	"at" bigint NOT NULL,
	"listed_at" bigint NOT NULL,
	"hatched_animal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eggs_status_household" CHECK ("eggs"."status" in ('available', 'incubating', 'hatched', 'removed')
        and ("eggs"."status" <> 'incubating' or "eggs"."household_id" is not null)
        and ("eggs"."status" <> 'available' or "eggs"."household_id" is null))
);
--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_hatched_animal_id_animals_id_fk" FOREIGN KEY ("hatched_animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eggs_status_idx" ON "eggs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "eggs_household_idx" ON "eggs" USING btree ("household_id");