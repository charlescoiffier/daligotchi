CREATE TABLE "friendships" (
	"player_a" uuid NOT NULL,
	"player_b" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_player_a_player_b_pk" PRIMARY KEY("player_a","player_b"),
	CONSTRAINT "friendships_ordered" CHECK ("friendships"."player_a" < "friendships"."player_b")
);
--> statement-breakpoint
CREATE TABLE "meeting_listings" (
	"animal_id" uuid PRIMARY KEY NOT NULL,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"inviter_animal_id" uuid NOT NULL,
	"invitee_animal_id" uuid NOT NULL,
	"phrase" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"interactions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" jsonb,
	"effects_applied_at" timestamp with time zone,
	"inviter_seen" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_player_a_players_id_fk" FOREIGN KEY ("player_a") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_player_b_players_id_fk" FOREIGN KEY ("player_b") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_players_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_listings" ADD CONSTRAINT "meeting_listings_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_inviter_id_players_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_invitee_id_players_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_inviter_animal_id_animals_id_fk" FOREIGN KEY ("inviter_animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_invitee_animal_id_animals_id_fk" FOREIGN KEY ("invitee_animal_id") REFERENCES "public"."animals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_invitee_idx" ON "meetings" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE INDEX "meetings_inviter_idx" ON "meetings" USING btree ("inviter_id","status");