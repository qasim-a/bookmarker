import { pgTable, text, timestamp, boolean, integer, uuid } from "drizzle-orm/pg-core";

export const leaders = pgTable("leaders", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaderId: uuid("leader_id").references(() => leaders.id).notNull(),
  name: text("name").notNull(),
  memberLink: text("member_link").notNull().unique(),
  memberPassword: text("member_password"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const books = pgTable("books", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  title: text("title").notNull(),
  author: text("author"),
  epubPath: text("epub_path").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chapters = pgTable("chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  content: text("content"),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  status: text("status").notNull().default("upcoming"),
  currentQuestionIndex: integer("current_question_index").default(0),
  // Whether the leader had AI question generation enabled when starting
  aiEnabled: boolean("ai_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingChapters = pgTable("meeting_chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
  chapterId: uuid("chapter_id").references(() => chapters.id).notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberAttendance = pgTable("member_attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  markedReading: boolean("marked_reading").default(false),
  markedAttending: boolean("marked_attending").default(false),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
  text: text("text").notNull(),
  source: text("source").notNull(), // "ai" | "member"
  memberId: uuid("member_id").references(() => members.id),
  votes: integer("votes").default(0),
  isSelected: boolean("is_selected").default(false),
  order: integer("order"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questionVotes = pgTable("question_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id").references(() => questions.id).notNull(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
});

export const archivedBooks = pgTable("archived_books", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  title: text("title").notNull(),
  author: text("author"),
  archivedAt: timestamp("archived_at").defaultNow(),
});