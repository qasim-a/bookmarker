import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetings, questions, clubs, meetingChapters, chapters, books } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateDiscussionQuestions } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

// Flips meeting from started → voting, optionally generating AI questions
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId, aiEnabled } = await request.json();

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

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

    if (meeting[0].status !== "started") {
      return NextResponse.json({ error: "Meeting is not in started phase" }, { status: 400 });
    }

    let generatedQuestions: {
      id: string;
      text: string;
      source: string;
      votes: number | null;
      isSelected: boolean | null;
      order: number | null;
      createdAt: Date | null;
      meetingId: string;
      memberId: string | null;
    }[] = [];

    if (aiEnabled) {
      const book = await db
        .select()
        .from(books)
        .where(eq(books.id, meeting[0].bookId))
        .limit(1);

      if (!book[0]) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }

      const assigned = await db
        .select({ title: chapters.title, content: chapters.content })
        .from(meetingChapters)
        .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
        .where(eq(meetingChapters.meetingId, meetingId))
        .orderBy(chapters.order);

      let generated: string[];
      try {
        generated = await generateDiscussionQuestions(
          book[0].title,
          book[0].author ?? "Unknown",
          assigned.map((a) => ({ title: a.title, content: a.content ?? "" }))
        );
      } catch {
        return NextResponse.json(
          { error: "AI generation failed. Please retry or turn off AI." },
          { status: 500 }
        );
      }

      if (!Array.isArray(generated) || generated.length !== 5) {
        return NextResponse.json(
          { error: "AI did not return exactly 5 questions. Please retry or turn off AI." },
          { status: 500 }
        );
      }

      generatedQuestions = await db
        .insert(questions)
        .values(
          generated.map((text) => ({
            meetingId,
            text,
            source: "ai" as const,
            votes: 0,
          }))
        )
        .returning();
    }

    await db
      .update(meetings)
      .set({ status: "voting", aiEnabled: aiEnabled ?? false })
      .where(eq(meetings.id, meetingId));

    return NextResponse.json({ questions: generatedQuestions });
  } catch (err) {
    console.error("Start voting error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}