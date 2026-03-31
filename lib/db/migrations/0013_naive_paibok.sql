ALTER TABLE "Chat" ADD COLUMN "parentChatId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_parentChatId_Chat_id_fk" FOREIGN KEY ("parentChatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
