import { db } from "@/db";
import { chapters, meetingChapters, meetings, books, clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { summarizeChapters } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { meetingId, memberLink } = await request.json();

    if (!meetingId || !memberLink) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.memberLink, memberLink))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    // Get meeting
    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting[0] || meeting[0].clubId !== club[0].id) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get book
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, meeting[0].bookId))
      .limit(1);

    // Get assigned chapters with content
    const assigned = await db
      .select({
        title: chapters.title,
        content: chapters.content,
      })
      .from(meetingChapters)
      .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
      .where(eq(meetingChapters.meetingId, meetingId))
      .orderBy(chapters.order);

    const summary = await summarizeChapters(
      book[0].title,
      book[0].author ?? "Unknown",
      assigned.map((a) => ({ title: a.title, content: a.content ?? "" }))
    );

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Summary error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}