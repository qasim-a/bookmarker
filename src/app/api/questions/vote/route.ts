import { db } from "@/db";
import { questions, questionVotes, members, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { questionId, memberId, memberLink } = await request.json();

    if (!questionId || !memberId || !memberLink) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify member belongs to this club
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.memberLink, memberLink))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const member = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.clubId, club[0].id)))
      .limit(1);

    if (!member[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent double voting
    const existing = await db
      .select()
      .from(questionVotes)
      .where(
        and(
          eq(questionVotes.questionId, questionId),
          eq(questionVotes.memberId, memberId)
        )
      )
      .limit(1);

    if (existing[0]) {
      // Unvote
      await db.delete(questionVotes).where(eq(questionVotes.id, existing[0].id));
      await db
        .update(questions)
        .set({ votes: Math.max(0, (await db.select().from(questions).where(eq(questions.id, questionId)).limit(1))[0].votes! - 1) })
        .where(eq(questions.id, questionId));
      return NextResponse.json({ voted: false });
    } else {
      // Vote
      await db.insert(questionVotes).values({ questionId, memberId });
      const q = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
      await db
        .update(questions)
        .set({ votes: (q[0].votes ?? 0) + 1 })
        .where(eq(questions.id, questionId));
      return NextResponse.json({ voted: true });
    }
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}