import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  customType,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ─── Memory System ────────────────────────────────────────────────────────────

// pgvector customType (drizzle-orm 0.34 doesn't ship vector() natively)
const vectorColumn = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 768})`;
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return JSON.parse(value as string) as number[];
  },
});

export interface ProposedFact {
  id: string;
  text: string;
  topic: string;
  confidence: number;
  sourceQuote: string;
  sourceMessageIds: string[];
}

export interface ProposedPursuit {
  id: string;
  title: string;
  rationale: string;
  urgency: "low" | "medium" | "high";
  sourceMessageIds: string[];
}

export const memoryChunk = pgTable("MemoryChunk", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  sourceMessageIds: json("sourceMessageIds").$type<string[]>().notNull().default([]),
  text: text("text").notNull(),
  embedding: vectorColumn("embedding", { dimensions: 768 }).notNull(),
  tags: json("tags").$type<string[]>().notNull().default([]),
  importance: real("importance").notNull().default(0.5),
  supersededBy: uuid("supersededBy"), // points to the chunk that replaced this one
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type MemoryChunk = InferSelectModel<typeof memoryChunk>;

export const narrative = pgTable("Narrative", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  topic: text("topic").notNull(),
  content: text("content").notNull().default(""),
  summary: text("summary"),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Narrative = InferSelectModel<typeof narrative>;

export const reflection = pgTable("Reflection", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  status: varchar("status", { enum: ["pending", "confirmed", "dismissed"] })
    .notNull()
    .default("pending"),
  proposedFacts: json("proposedFacts").$type<ProposedFact[]>().notNull().default([]),
  proposedPursuits: json("proposedPursuits").$type<ProposedPursuit[]>().notNull().default([]),
  casualTopics: json("casualTopics").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Reflection = InferSelectModel<typeof reflection>;

export const reflectionFeedback = pgTable("ReflectionFeedback", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  reflectionId: uuid("reflectionId")
    .notNull()
    .references(() => reflection.id),
  itemId: text("itemId").notNull(),
  itemType: varchar("itemType", { enum: ["fact", "pursuit"] }).notNull(),
  action: varchar("action", { enum: ["accept", "reject", "edit"] }).notNull(),
  editedText: text("editedText"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ReflectionFeedback = InferSelectModel<typeof reflectionFeedback>;

export const memoryIngestionLog = pgTable("MemoryIngestionLog", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  agentType: varchar("agentType", { enum: ["reflection", "knowledge"] }).notNull(),
  processedMessageIds: json("processedMessageIds").$type<string[]>().notNull().default([]),
  ingestedAt: timestamp("ingestedAt").notNull().defaultNow(),
});

export type MemoryIngestionLog = InferSelectModel<typeof memoryIngestionLog>;
