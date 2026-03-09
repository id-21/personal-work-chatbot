import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getPendingReflectionsByUser } from "@/lib/memory/queries";
import { ReflectionList } from "@/components/reflection-list";

export default async function ReflectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/guest");

  const reflections = await getPendingReflectionsByUser({ userId: session.user.id });

  return (
    <div className="flex flex-col items-center w-full min-h-dvh bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold mb-2">Memory Reflections</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Review what the AI extracted from your recent conversations. Accept,
          edit, or reject each item before it gets saved to your long-term
          memory.
        </p>
        {reflections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending reflections. After a conversation ends, the AI will
            propose memory items here for your review.
          </p>
        ) : (
          <ReflectionList reflections={reflections} />
        )}
      </div>
    </div>
  );
}
