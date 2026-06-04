import { db } from "@/db";
import { meetings, questions, members, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { meetingId, memberId, text, memberLink } = await request.json();

    if (!meetingId || !memberId || !text?.trim() || !memberLink) {
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

    // Verify meeting belongs to this club
    const meeting = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
      .limit(1);

    if (!meeting[0]) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Hard cutoff — only allow submissions during upcoming phase
    if (meeting[0].status !== "started") {
      return NextResponse.json(
        { error: "Voting has already started. Questions are no longer accepted." },
        { status: 400 }
      );
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

    // Check if member already submitted a question for this meeting
    const existing = await db
      .select()
      .from(questions)
      .where(and(eq(questions.meetingId, meetingId), eq(questions.memberId, memberId)));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted a question for this meeting." },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(questions)
      .values({
        meetingId,
        memberId,
        text: text.trim(),
        source: "member",
        votes: 0,
      })
      .returning();

    return NextResponse.json({ question: inserted[0] });
  } catch (err) {
    console.error("Submit question error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}