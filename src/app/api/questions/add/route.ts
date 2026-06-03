import { db } from "@/db";
import { questions, members, clubs, meetings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { meetingId, memberId, memberLink, text } = await request.json();

    if (!meetingId || !memberId || !memberLink || !text) {
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

    const member = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.clubId, club[0].id)))
      .limit(1);

    if (!member[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const meeting = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
      .limit(1);

    if (!meeting[0] || meeting[0].status !== "voting") {
      return NextResponse.json({ error: "Meeting not in voting phase" }, { status: 400 });
    }

    const question = await db
      .insert(questions)
      .values({
        meetingId,
        memberId,
        text: text.trim(),
        source: "member",
        votes: 0,
      })
      .returning();

    return NextResponse.json({ question: question[0] });
  } catch (err) {
    console.error("Add question error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}