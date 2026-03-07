import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { KbViewer } from "@/components/kb-viewer";
import { getKnowledgeBaseDocument } from "@/lib/db/queries";

export default async function KnowledgeBasePage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/guest");

  const doc = await getKnowledgeBaseDocument({ userId: session.user.id });

  return (
    <div className="flex flex-col items-center w-full min-h-dvh bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold mb-6">Knowledge Base</h1>
        {doc ? (
          <KbViewer docId={doc.id} />
        ) : (
          <p className="text-muted-foreground text-sm">
            No knowledge base yet. Have a conversation with 5 or more messages
            and it will be built automatically.
          </p>
        )}
      </div>
    </div>
  );
}
