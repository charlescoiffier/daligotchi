CREATE TABLE "clutches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"animal_a" uuid NOT NULL,
	"animal_b" uuid NOT NULL,
	"number" integer NOT NULL,
	"household_id" uuid NOT NULL,
	"laid_at" bigint NOT NULL,
	"egg_count" integer NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	CONSTRAINT "clutches_pair_number" UNIQUE("animal_a","animal_b","number")
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"animal_a" uuid NOT NULL,
	"animal_b" uuid NOT NULL,
	"interaction" double precision NOT NULL,
	"at" bigint NOT NULL,
	CONSTRAINT "pairs_animal_a_animal_b_pk" PRIMARY KEY("animal_a","animal_b"),
	CONSTRAINT "pairs_ordered" CHECK ("pairs"."animal_a" < "pairs"."animal_b")
);
--> statement-breakpoint
ALTER TABLE "eggs" DROP CONSTRAINT "eggs_status_household";--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "parent_a_id" uuid;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "parent_b_id" uuid;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "last_clutch_at" bigint;--> statement-breakpoint
ALTER TABLE "eggs" ADD COLUMN "parent_a_id" uuid;--> statement-breakpoint
ALTER TABLE "eggs" ADD COLUMN "parent_b_id" uuid;--> statement-breakpoint
ALTER TABLE "eggs" ADD COLUMN "clutch_id" uuid;--> statement-breakpoint
ALTER TABLE "clutches" ADD CONSTRAINT "clutches_animal_a_animals_id_fk" FOREIGN KEY ("animal_a") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clutches" ADD CONSTRAINT "clutches_animal_b_animals_id_fk" FOREIGN KEY ("animal_b") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clutches" ADD CONSTRAINT "clutches_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_animal_a_animals_id_fk" FOREIGN KEY ("animal_a") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_animal_b_animals_id_fk" FOREIGN KEY ("animal_b") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_parent_a_id_animals_id_fk" FOREIGN KEY ("parent_a_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_parent_b_id_animals_id_fk" FOREIGN KEY ("parent_b_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_parent_a_id_animals_id_fk" FOREIGN KEY ("parent_a_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_parent_b_id_animals_id_fk" FOREIGN KEY ("parent_b_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_clutch_id_clutches_id_fk" FOREIGN KEY ("clutch_id") REFERENCES "public"."clutches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_status_household" CHECK ("eggs"."status" in ('nest', 'available', 'incubating', 'hatched', 'removed')
        and ("eggs"."status" not in ('incubating', 'nest') or "eggs"."household_id" is not null)
        and ("eggs"."status" <> 'available' or "eggs"."household_id" is null));