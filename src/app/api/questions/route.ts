import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, meetings, meetingChapters, chapters, books, clubs, members, questionVotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateDiscussionQuestions } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

// Generate AI questions — leader only
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await request.json();

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

    const generated = await generateDiscussionQuestions(
      book[0].title,
      book[0].author ?? "Unknown",
      assigned.map((a) => ({ title: a.title, content: a.content ?? "" }))
    );

    const inserted = await db
      .insert(questions)
      .values(
        generated.map((text) => ({
          meetingId,
          text,
          source: "ai",
          votes: 0,
        }))
      )
      .returning();

    return NextResponse.json({ questions: inserted });
  } catch (err) {
    console.error("Generate questions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Get questions for a meeting — anyone with memberLink
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meetingId");
    const memberId = searchParams.get("memberId");

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.meetingId, meetingId))
      .orderBy(questions.votes);

    // Check which questions this member has voted for
    const voted: string[] = [];
    if (memberId) {
      const votes = await db
        .select()
        .from(questionVotes)
        .where(eq(questionVotes.memberId, memberId));
      voted.push(...votes.map((v) => v.questionId));
    }

    return NextResponse.json({ questions: qs, voted });
  } catch (err) {
    console.error("Get questions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}