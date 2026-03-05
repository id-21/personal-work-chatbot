import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import { generateUUID } from "../utils";
import {
  type Chat,
  type ContextSummary,
  chat,
  contextSummary,
  type DBMessage,
  document,
  type MemoryChunk,
  memoryChunk,
  message,
  type Narrative,
  narrative,
  type Project,
  type Pursuit,
  type PursuitThought,
  project,
  pursuit,
  pursuitThought,
  type RoutingLog,
  routingLog,
  type Suggestion,
  stream,
  suggestion,
  type Task,
  task,
  type User,
  type UserModel,
  user,
  userModel,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update title for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ─── Personal OS Queries ──────────────────────────────────────────────────────

// User Model

export async function getUserModelByUserId({
  userId,
}: {
  userId: string;
}): Promise<UserModel | null> {
  try {
    const [result] = await db
      .select()
      .from(userModel)
      .where(eq(userModel.userId, userId));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get user model");
  }
}

export async function upsertUserModel({
  userId,
  name,
  values,
  resourceBudget,
  rawContext,
}: {
  userId: string;
  name?: string;
  values?: string[];
  resourceBudget?: Record<string, string>;
  rawContext?: string;
}): Promise<UserModel> {
  try {
    const existing = await getUserModelByUserId({ userId });
    if (existing) {
      const [updated] = await db
        .update(userModel)
        .set({
          ...(name !== undefined && { name }),
          ...(values !== undefined && { values }),
          ...(resourceBudget !== undefined && { resourceBudget }),
          ...(rawContext !== undefined && { rawContext }),
          updatedAt: new Date(),
        })
        .where(eq(userModel.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(userModel)
      .values({
        userId,
        name: name ?? null,
        values: values ?? [],
        resourceBudget: resourceBudget ?? {},
        rawContext: rawContext ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert user model"
    );
  }
}

// Pursuits

export async function createPursuit({
  userId,
  name,
  vision,
  currentState,
  constraints,
  opportunities,
  displayOrder,
}: {
  userId: string;
  name: string;
  vision?: string;
  currentState?: string;
  constraints?: string[];
  opportunities?: string[];
  displayOrder?: number;
}): Promise<Pursuit> {
  try {
    const [created] = await db
      .insert(pursuit)
      .values({
        userId,
        name,
        vision: vision ?? null,
        currentState: currentState ?? null,
        constraints: constraints ?? [],
        opportunities: opportunities ?? [],
        displayOrder: displayOrder ?? 0,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create pursuit");
  }
}

export async function getPursuitsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Pursuit[]> {
  try {
    return await db
      .select()
      .from(pursuit)
      .where(eq(pursuit.userId, userId))
      .orderBy(asc(pursuit.displayOrder), asc(pursuit.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get pursuits by user id"
    );
  }
}

export async function getPursuitById({
  id,
}: {
  id: string;
}): Promise<Pursuit | null> {
  try {
    const [result] = await db.select().from(pursuit).where(eq(pursuit.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get pursuit");
  }
}

export async function updatePursuitById({
  id,
  userId,
  updates,
}: {
  id: string;
  userId: string;
  updates: Partial<
    Pick<
      Pursuit,
      | "name"
      | "vision"
      | "currentState"
      | "constraints"
      | "opportunities"
      | "displayOrder"
    >
  >;
}): Promise<Pursuit> {
  try {
    const [updated] = await db
      .update(pursuit)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(pursuit.id, id), eq(pursuit.userId, userId)))
      .returning();
    if (!updated) {
      throw new ChatSDKError(
        "not_found:database",
        "Pursuit not found or not owned by user"
      );
    }
    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update pursuit");
  }
}

export async function deletePursuitById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    // cascade: tasks → projects → pursuit_thoughts → pursuit
    const projects = await db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.pursuitId, id));
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length > 0) {
      await db.delete(task).where(inArray(task.projectId, projectIds));
      await db.delete(project).where(inArray(project.id, projectIds));
    }

    await db.delete(pursuitThought).where(eq(pursuitThought.pursuitId, id));
    await db
      .delete(contextSummary)
      .where(
        and(eq(contextSummary.scopeId, id), eq(contextSummary.scope, "pursuit"))
      );

    const [deleted] = await db
      .delete(pursuit)
      .where(and(eq(pursuit.id, id), eq(pursuit.userId, userId)))
      .returning();
    return deleted;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete pursuit");
  }
}

// Projects

export async function createProject({
  pursuitId,
  name,
  description,
  status,
}: {
  pursuitId: string;
  name: string;
  description?: string;
  status?: Project["status"];
}): Promise<Project> {
  try {
    const [created] = await db
      .insert(project)
      .values({
        pursuitId,
        name,
        description: description ?? null,
        status: status ?? "active",
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}

export async function getProjectsByPursuitId({
  pursuitId,
}: {
  pursuitId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.pursuitId, pursuitId))
      .orderBy(asc(project.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get projects by pursuit id"
    );
  }
}

export async function getProjectById({
  id,
}: {
  id: string;
}): Promise<Project | null> {
  try {
    const [result] = await db.select().from(project).where(eq(project.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get project");
  }
}

export async function updateProjectById({
  id,
  updates,
}: {
  id: string;
  updates: Partial<Pick<Project, "name" | "description" | "status">>;
}): Promise<Project> {
  try {
    const [updated] = await db
      .update(project)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();
    if (!updated) {
      throw new ChatSDKError("not_found:database", "Project not found");
    }
    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update project");
  }
}

// Tasks

export async function createTask({
  projectId,
  title,
  detail,
  status,
  source,
}: {
  projectId: string;
  title: string;
  detail?: string;
  status?: Task["status"];
  source?: Task["source"];
}): Promise<Task> {
  try {
    const [created] = await db
      .insert(task)
      .values({
        projectId,
        title,
        detail: detail ?? null,
        status: status ?? "open",
        source: source ?? "user",
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create task");
  }
}

export async function getTasksByProjectId({
  projectId,
}: {
  projectId: string;
}): Promise<Task[]> {
  try {
    return await db
      .select()
      .from(task)
      .where(eq(task.projectId, projectId))
      .orderBy(asc(task.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get tasks by project id"
    );
  }
}

export async function getTaskById({
  id,
}: {
  id: string;
}): Promise<Task | null> {
  try {
    const [result] = await db.select().from(task).where(eq(task.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get task");
  }
}

export async function updateTaskById({
  id,
  updates,
}: {
  id: string;
  updates: Partial<Pick<Task, "title" | "detail" | "status">>;
}): Promise<Task> {
  try {
    const [updated] = await db
      .update(task)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(task.id, id))
      .returning();
    if (!updated) {
      throw new ChatSDKError("not_found:database", "Task not found");
    }
    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update task");
  }
}

// Pursuit Thoughts

export async function createPursuitThought({
  pursuitId,
  author,
  content,
}: {
  pursuitId: string;
  author: PursuitThought["author"];
  content: string;
}): Promise<PursuitThought> {
  try {
    const [created] = await db
      .insert(pursuitThought)
      .values({ pursuitId, author, content })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create pursuit thought"
    );
  }
}

export async function getPursuitThoughtsByPursuitId({
  pursuitId,
  limit = 50,
}: {
  pursuitId: string;
  limit?: number;
}): Promise<PursuitThought[]> {
  try {
    return await db
      .select()
      .from(pursuitThought)
      .where(eq(pursuitThought.pursuitId, pursuitId))
      .orderBy(desc(pursuitThought.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get pursuit thoughts"
    );
  }
}

// Context Summaries

export async function upsertContextSummary({
  scopeId,
  scope,
  summary,
  coversUntil,
}: {
  scopeId: string;
  scope: ContextSummary["scope"];
  summary: string;
  coversUntil: Date;
}): Promise<ContextSummary> {
  try {
    const [existing] = await db
      .select()
      .from(contextSummary)
      .where(
        and(
          eq(contextSummary.scopeId, scopeId),
          eq(contextSummary.scope, scope)
        )
      );

    if (existing) {
      const [updated] = await db
        .update(contextSummary)
        .set({ summary, coversUntil, updatedAt: new Date() })
        .where(eq(contextSummary.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(contextSummary)
      .values({ scopeId, scope, summary, coversUntil })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert context summary"
    );
  }
}

export async function getContextSummaryByScopeId({
  scopeId,
}: {
  scopeId: string;
}): Promise<ContextSummary | null> {
  try {
    const [result] = await db
      .select()
      .from(contextSummary)
      .where(eq(contextSummary.scopeId, scopeId))
      .orderBy(desc(contextSummary.updatedAt));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get context summary"
    );
  }
}

// Routing Log

export async function createRoutingLog({
  userId,
  rawInput,
  classifiedPursuitId,
  classifiedProjectId,
  action,
  entityId,
}: {
  userId: string;
  rawInput: string;
  classifiedPursuitId?: string;
  classifiedProjectId?: string;
  action?: RoutingLog["action"];
  entityId?: string;
}): Promise<RoutingLog> {
  try {
    const [created] = await db
      .insert(routingLog)
      .values({
        userId,
        rawInput,
        classifiedPursuitId: classifiedPursuitId ?? null,
        classifiedProjectId: classifiedProjectId ?? null,
        action: action ?? null,
        entityId: entityId ?? null,
        userConfirmed: null,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create routing log"
    );
  }
}

export async function updateRoutingLogConfirmation({
  id,
  userConfirmed,
}: {
  id: string;
  userConfirmed: boolean;
}) {
  try {
    return await db
      .update(routingLog)
      .set({ userConfirmed })
      .where(eq(routingLog.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update routing log"
    );
  }
}

// Rich read: full pursuit with projects and their tasks
export async function getPursuitsWithProjects({ userId }: { userId: string }) {
  try {
    const pursuits = await getPursuitsByUserId({ userId });
    return await Promise.all(
      pursuits.map(async (p) => ({
        ...p,
        projects: await getProjectsByPursuitId({ pursuitId: p.id }),
      }))
    );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get pursuits with projects"
    );
  }
}

export async function getPursuitWithDetail({ id }: { id: string }) {
  try {
    const pursuitData = await getPursuitById({ id });
    if (!pursuitData) return null;

    const projects = await getProjectsByPursuitId({ pursuitId: id });
    const projectsWithTasks = await Promise.all(
      projects.map(async (p) => ({
        ...p,
        tasks: await getTasksByProjectId({ projectId: p.id }),
      }))
    );

    const summary = await getContextSummaryByScopeId({ scopeId: id });
    const recentThoughts = await getPursuitThoughtsByPursuitId({
      pursuitId: id,
      limit: 20,
    });

    return {
      ...pursuitData,
      projects: projectsWithTasks,
      contextSummary: summary?.summary ?? null,
      recentThoughts,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get pursuit with detail"
    );
  }
}

// ─── Memory Chunks ────────────────────────────────────────────────────────────

export async function createMemoryChunk({
  userId,
  text,
  embedding,
  tags = [],
  entityType,
  linkedPursuits = [],
  importance = 0.5,
}: {
  userId: string;
  text: string;
  embedding: number[];
  tags?: string[];
  entityType?: MemoryChunk["entityType"];
  linkedPursuits?: string[];
  importance?: number;
}): Promise<MemoryChunk> {
  try {
    const [created] = await db
      .insert(memoryChunk)
      .values({
        userId,
        text,
        embedding,
        tags,
        entityType: entityType ?? null,
        linkedPursuits,
        importance,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create memory chunk"
    );
  }
}

export async function vectorSearch({
  queryEmbedding,
  userId,
  matchCount,
  filterPursuits,
}: {
  queryEmbedding: number[];
  userId: string;
  matchCount: number;
  filterPursuits?: string[];
}): Promise<
  Array<{
    id: string;
    text: string;
    tags: string[];
    importance: number;
    similarity: number;
  }>
> {
  try {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const result = await db.execute(
      sql`SELECT * FROM vector_search(
        ${embeddingStr}::vector,
        ${matchCount}::int,
        ${userId}::uuid,
        ${filterPursuits ?? null}::text[]
      )`
    );
    // postgres.js driver returns rows directly (not result.rows)
    return result as unknown as Array<{
      id: string;
      text: string;
      tags: string[];
      importance: number;
      similarity: number;
    }>;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to run vector search"
    );
  }
}

export async function supersedeChunk({
  id,
  supersededById,
}: {
  id: string;
  supersededById: string;
}): Promise<void> {
  try {
    await db
      .update(memoryChunk)
      .set({ supersededBy: supersededById })
      .where(eq(memoryChunk.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to supersede memory chunk"
    );
  }
}

// ─── Narratives ───────────────────────────────────────────────────────────────

export async function getNarrativeByTopic({
  userId,
  topic,
}: {
  userId: string;
  topic: string;
}): Promise<Narrative | null> {
  try {
    const [result] = await db
      .select()
      .from(narrative)
      .where(and(eq(narrative.userId, userId), eq(narrative.topic, topic)));
    return result ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get narrative by topic"
    );
  }
}

export async function upsertNarrative({
  userId,
  topic,
  topicType,
  content,
  summary,
}: {
  userId: string;
  topic: string;
  topicType: Narrative["topicType"];
  content: string;
  summary?: string;
}): Promise<Narrative> {
  try {
    const existing = await getNarrativeByTopic({ userId, topic });
    if (existing) {
      const [updated] = await db
        .update(narrative)
        .set({
          content,
          ...(summary !== undefined && { summary }),
          version: existing.version + 1,
          lastUpdated: new Date(),
        })
        .where(eq(narrative.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(narrative)
      .values({
        userId,
        topic,
        topicType,
        content,
        summary: summary ?? null,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert narrative"
    );
  }
}

export async function getNarrativesByUserId({
  userId,
}: {
  userId: string;
}): Promise<Narrative[]> {
  try {
    return await db
      .select()
      .from(narrative)
      .where(eq(narrative.userId, userId))
      .orderBy(desc(narrative.lastUpdated));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get narratives by user id"
    );
  }
}
