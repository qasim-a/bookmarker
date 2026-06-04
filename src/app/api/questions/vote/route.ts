import { db } from "@/db";
import { questions, questionVotes, members, clubs, meetings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { questionId, memberId, memberLink } = await request.json();

    if (!questionId || !memberId || !memberLink) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify club
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.memberLink, memberLink))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    // Verify member belongs to this club
    const member = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.clubId, club[0].id)))
      .limit(1);

    if (!member[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Verify question exists and get current vote count
    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question[0]) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Verify meeting is in voting phase
    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, question[0].meetingId))
      .limit(1);

    if (!meeting[0] || meeting[0].status !== "voting") {
      return NextResponse.json({ error: "Voting is not active" }, { status: 400 });
    }

    // Check if already liked
    const existing = await db
      .select()
      .from(questionVotes)
      .where(and(eq(questionVotes.questionId, questionId), eq(questionVotes.memberId, memberId)))
      .limit(1);

    let liked: boolean;

    if (existing[0]) {
      // Unlike
      await db
        .delete(questionVotes)
        .where(and(eq(questionVotes.questionId, questionId), eq(questionVotes.memberId, memberId)));

      await db
        .update(questions)
        .set({ votes: Math.max(0, (question[0].votes ?? 0) - 1) })
        .where(eq(questions.id, questionId));

      liked = false;
    } else {
      // Like
      await db.insert(questionVotes).values({ questionId, memberId });

      await db
        .update(questions)
        .set({ votes: (question[0].votes ?? 0) + 1 })
        .where(eq(questions.id, questionId));

      liked = true;
    }

    const updated = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    return NextResponse.json({ liked, votes: updated[0].votes ?? 0 });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}