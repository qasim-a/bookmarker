import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, meetings, meetingChapters, chapters, books, clubs, members, questionVotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateDiscussionQuestions } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";


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