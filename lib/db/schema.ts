import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
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
import { vector } from "drizzle-orm/pg-core";

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

// ─── Personal OS Tables ───────────────────────────────────────────────────────

export const userModel = pgTable("user_model", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .unique()
    .references(() => user.id),
  name: text("name"),
  values: json("values").$type<string[]>().notNull().default([]),
  resourceBudget: json("resourceBudget")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  rawContext: text("rawContext"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserModel = InferSelectModel<typeof userModel>;

export const pursuit = pgTable("pursuits", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  vision: text("vision"),
  currentState: text("currentState"),
  constraints: json("constraints").$type<string[]>().notNull().default([]),
  opportunities: json("opportunities").$type<string[]>().notNull().default([]),
  displayOrder: integer("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Pursuit = InferSelectModel<typeof pursuit>;

export const project = pgTable("projects", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  pursuitId: uuid("pursuitId")
    .notNull()
    .references(() => pursuit.id),
  name: text("name").notNull(),
  description: text("description"),
  status: varchar("status", {
    enum: ["active", "paused", "completed", "idea"],
  })
    .notNull()
    .default("active"),
  narrativeId: uuid("narrativeId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Project = InferSelectModel<typeof project>;

export const task = pgTable("tasks", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("projectId")
    .notNull()
    .references(() => project.id),
  title: text("title").notNull(),
  detail: text("detail"),
  status: varchar("status", {
    enum: ["open", "in_progress", "done", "dismissed"],
  })
    .notNull()
    .default("open"),
  source: varchar("source", { enum: ["user", "ai_suggested"] })
    .notNull()
    .default("user"),
  contextChunkIds: json("contextChunkIds").$type<string[]>().notNull().default([]),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Task = InferSelectModel<typeof task>;

export const pursuitThought = pgTable("pursuit_thoughts", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  pursuitId: uuid("pursuitId")
    .notNull()
    .references(() => pursuit.id),
  author: varchar("author", { enum: ["user", "ai"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PursuitThought = InferSelectModel<typeof pursuitThought>;

export const contextSummary = pgTable("context_summaries", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  scopeId: uuid("scopeId").notNull(),
  scope: varchar("scope", { enum: ["pursuit", "project"] }).notNull(),
  summary: text("summary").notNull(),
  coversUntil: timestamp("coversUntil").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ContextSummary = InferSelectModel<typeof contextSummary>;

export const memoryChunk = pgTable("memory_chunks", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  tags: json("tags").$type<string[]>().notNull().default([]),
  entityType: varchar("entityType", {
    enum: ["business", "person", "challenge", "insight", "preference"],
  }),
  linkedPursuits: json("linkedPursuits").$type<string[]>().notNull().default([]),
  importance: real("importance").notNull().default(0.5),
  supersededBy: uuid("supersededBy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type MemoryChunk = InferSelectModel<typeof memoryChunk>;

export const narrative = pgTable("narratives", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  topic: text("topic").notNull(),
  topicType: varchar("topicType", {
    enum: ["business", "pursuit", "person", "domain"],
  }).notNull(),
  content: text("content").notNull().default(""),
  summary: text("summary"),
  version: integer("version").notNull().default(1),
  lastUpdated: timestamp("lastUpdated").notNull().defaultNow(),
});

export type Narrative = InferSelectModel<typeof narrative>;

export const routingLog = pgTable("routing_log", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  rawInput: text("rawInput").notNull(),
  classifiedPursuitId: uuid("classifiedPursuitId"),
  classifiedProjectId: uuid("classifiedProjectId"),
  action: varchar("action", {
    enum: ["created_task", "updated_task", "created_project", "no_action"],
  }),
  entityId: uuid("entityId"),
  userConfirmed: boolean("userConfirmed"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type RoutingLog = InferSelectModel<typeof routingLog>;
