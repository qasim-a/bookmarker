import { db } from "@/db";
import { meetings, clubs, questions, questionVotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meetingId");
    const memberLink = searchParams.get("memberLink");
    const memberId = searchParams.get("memberId");

    if (!meetingId || !memberLink) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.memberLink, memberLink))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const meeting = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
      .limit(1);

    if (!meeting[0]) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const status = meeting[0].status;
    const currentQuestionIndex = meeting[0].currentQuestionIndex ?? 0;

    // started: no questions needed, just signal the phase change
    if (status === "upcoming" || status === "started") {
      return NextResponse.json({
        status,
        currentQuestionIndex: 0,
        questions: [],
        likedIds: [],
      });
    }

    // voting: all questions + member's liked IDs
    if (status === "voting") {
      const allQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.meetingId, meetingId))
        .orderBy(questions.createdAt);

      const likedIds: string[] = [];
      if (memberId) {
        const votes = await db
          .select()
          .from(questionVotes)
          .where(eq(questionVotes.memberId, memberId));
        likedIds.push(...votes.map((v) => v.questionId));
      }

      return NextResponse.json({
        status,
        currentQuestionIndex,
        questions: allQuestions,
        likedIds,
      });
    }

    // discussing / finished: selected questions in order
    if (status === "discussing" || status === "finished") {
      const selectedQuestions = await db
        .select()
        .from(questions)
        .where(and(eq(questions.meetingId, meetingId), eq(questions.isSelected, true)));

      const sorted = selectedQuestions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      return NextResponse.json({
        status,
        currentQuestionIndex,
        questions: sorted,
        likedIds: [],
      });
    }

    return NextResponse.json({
      status,
      currentQuestionIndex: 0,
      questions: [],
      likedIds: [],
    });
  } catch (err) {
    console.error("Meeting status poll error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}