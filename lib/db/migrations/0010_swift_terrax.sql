CREATE TABLE IF NOT EXISTS "MemoryIngestionLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"agentType" varchar NOT NULL,
	"processedMessageIds" json DEFAULT '[]'::json NOT NULL,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MemoryIngestionLog" ADD CONSTRAINT "MemoryIngestionLog_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MemoryIngestionLog" ADD CONSTRAINT "MemoryIngestionLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
