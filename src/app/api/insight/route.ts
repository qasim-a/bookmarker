import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetings, meetingChapters, chapters, books, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { answerQuestion } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId, question } = await request.json();

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.leaderId, session.user.id))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "No club found" }, { status: 404 });
    }

    const meeting = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
      .limit(1);

    if (!meeting[0]) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, meeting[0].bookId))
      .limit(1);

    const assigned = await db
      .select({ title: chapters.title, content: chapters.content })
      .from(meetingChapters)
      .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
      .where(eq(meetingChapters.meetingId, meetingId))
      .orderBy(chapters.order);

    const insight = await answerQuestion(
      book[0].title,
      book[0].author ?? "Unknown",
      question,
      assigned.map((a) => ({ title: a.title, content: a.content ?? "" }))
    );

    return NextResponse.json({ insight });
  } catch (err) {
    console.error("Insight error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}