CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"tags" json DEFAULT '[]'::json NOT NULL,
	"entityType" varchar,
	"linkedPursuits" json DEFAULT '[]'::json NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"supersededBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "narratives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"topic" text NOT NULL,
	"topicType" varchar NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"version" integer DEFAULT 1 NOT NULL,
	"lastUpdated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "narrativeId" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "contextChunkIds" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "narratives" ADD CONSTRAINT "narratives_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
