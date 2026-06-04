import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetings, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Flips meeting from upcoming → started (leader opens the meeting room)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await request.json();

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

    if (meeting[0].status !== "upcoming") {
      return NextResponse.json({ error: "Meeting already started" }, { status: 400 });
    }

    await db
      .update(meetings)
      .set({ status: "started" })
      .where(eq(meetings.id, meetingId));

    return NextResponse.json({ status: "started" });
  } catch (err) {
    console.error("Start meeting error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}