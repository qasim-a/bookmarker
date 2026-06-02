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
  memberLink: text("member_link").notNull().unique(), // random slug, persistent
  memberPassword: text("member_password"), // null means no password
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
  content: text("content"), // extracted text for AI use
});

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | voting | discussing | finished
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
  memberId: uuid("member_id").references(() => members.id), // null if ai
  votes: integer("votes").default(0),
  isSelected: boolean("is_selected").default(false), // top 5 chosen for discussion
  order: integer("order"), // order during discussion phase
  createdAt: timestamp("created_at").defaultNow(),
});

export const archivedBooks = pgTable("archived_books", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubs.id).notNull(),
  title: text("title").notNull(),
  author: text("author"),
  archivedAt: timestamp("archived_at").defaultNow(),
});

export const archivedMeetings = pgTable("archived_meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  archivedBookId: uuid("archived_book_id").references(() => archivedBooks.id).notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  assignedChapters: text("assigned_chapters").notNull(), // JSON string of chapter titles
});