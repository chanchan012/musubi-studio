import {
  pgTable, pgEnum, text, uuid, timestamp, integer, real, boolean, jsonb, primaryKey, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("deck_role", ["owner", "editor", "viewer"]);
export const itemKindEnum = pgEnum("item_kind", ["card", "mcq"]);
export const difficultyEnum = pgEnum("difficulty", ["foundational", "application", "synthesis"]);
export const authorKindEnum = pgEnum("author_kind", ["human", "agent"]);
export const rootCauseEnum = pgEnum("root_cause", [
  "knowledge_gap", "misread_stem", "premature_closure", "calculation_error",
]);

const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email"),
  name: text("name"),
  imageUrl: text("image_url"),
  createdAt: ts("created_at"),
});

export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  examTrack: text("exam_track"),
  subject: text("subject"),
  coverKey: text("cover_key"), // R2 key
  isPublic: boolean("is_public").notNull().default(false),
  forkedFromDeckId: uuid("forked_from_deck_id"), // attribution for community clones
  forkedFromUserId: text("forked_from_user_id"),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
}, (t) => [index("decks_owner_idx").on(t.ownerId)]);

export const deckMembers = pgTable("deck_members", {
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdAt: ts("created_at"),
}, (t) => [primaryKey({ columns: [t.deckId, t.userId] }), index("deck_members_user_idx").on(t.userId)]);

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  kind: itemKindEnum("kind").notNull(),
  // flashcard
  front: text("front"),
  back: text("back"),
  cloze: text("cloze"), // {{c1::term}}
  mnemonic: text("mnemonic"),
  pearl: text("pearl"),
  diagramKey: text("diagram_key"), // R2 key
  compareTable: jsonb("compare_table").$type<{ headers: string[]; rows: string[][] }>(), // dual-coding table
  // mcq
  stem: text("stem"),
  options: jsonb("options").$type<string[]>(), // 4–5 choices A–E
  answerIdx: integer("answer_idx"),
  rationales: jsonb("rationales").$type<{ key: string; options: string[] }>(),
  difficulty: difficultyEnum("difficulty"),
  citation: text("citation"),
  blueprint: text("blueprint"), // exam blueprint domain
  authorKind: authorKindEnum("author_kind").notNull().default("human"),
  authorId: text("author_id").references(() => users.id),
  forkedFrom: uuid("forked_from"),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
}, (t) => [index("items_deck_idx").on(t.deckId)]);

export const reviewStates = pgTable("review_states", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  due: timestamp("due", { withTimezone: true }).notNull().defaultNow(),
  stability: real("stability").notNull().default(0),
  difficulty: real("difficulty").notNull().default(0),
  elapsedDays: integer("elapsed_days").notNull().default(0),
  scheduledDays: integer("scheduled_days").notNull().default(0),
  learningSteps: integer("learning_steps").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  state: integer("state").notNull().default(0), // ts-fsrs State
  lastReview: timestamp("last_review", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.itemId] }), index("review_due_idx").on(t.userId, t.due)]);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  choiceIdx: integer("choice_idx"),
  correct: boolean("correct").notNull(),
  certainty: integer("certainty"), // 1..3 (CBM)
  ms: integer("ms"),
  eliminations: jsonb("eliminations").$type<number[]>(),
  trapTags: jsonb("trap_tags").$type<Record<string, string>>(),
  createdAt: ts("created_at"),
}, (t) => [index("attempts_user_idx").on(t.userId), index("attempts_item_idx").on(t.itemId)]);

export const errorLog = pgTable("error_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  rootCause: rootCauseEnum("root_cause"),
  notes: text("notes"),
  redrillAt: jsonb("redrill_at").$type<string[]>(), // Day 1/3/7 ISO dates
  createdAt: ts("created_at"),
}, (t) => [index("error_log_user_idx").on(t.userId)]);

export const mcpTokens = pgTable("mcp_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(), // sha256 hex
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: ts("created_at"),
}, (t) => [uniqueIndex("mcp_tokens_hash_idx").on(t.tokenHash)]);

export const communityPosts = pgTable("community_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  publisherId: text("publisher_id").notNull().references(() => users.id),
  track: text("track").notNull(),
  subject: text("subject"),
  topic: text("topic"),
  score: integer("score").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  createdAt: ts("created_at"),
}, (t) => [index("community_track_idx").on(t.track), uniqueIndex("community_deck_idx").on(t.deckId)]);

export const communityVotes = pgTable("community_votes", {
  postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // -1 | 1
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const errata = pgTable("errata", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: ts("created_at"),
}, (t) => [index("errata_item_idx").on(t.itemId)]);

export const itemStats = pgTable("item_stats", {
  itemId: uuid("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  attempts: integer("attempts").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  optionCounts: jsonb("option_counts").$type<number[]>(),
  updatedAt: ts("updated_at"),
});

export const feynmanNotes = pgTable("feynman_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  body: text("body").notNull(), // learner's plain-English "why & how"
  agentFeedback: text("agent_feedback"), // written by a connected MCP agent
  createdAt: ts("created_at"),
}, (t) => [index("feynman_user_item_idx").on(t.userId, t.itemId)]);
