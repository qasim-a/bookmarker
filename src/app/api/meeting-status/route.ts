import { db } from "@/db";
import { meetings, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meetingId");
    const memberLink = searchParams.get("memberLink");

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
      .where(
        and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id))
      )
      .limit(1);

    if (!meeting[0]) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({ status: meeting[0].status });
  } catch (err) {
    console.error("Meeting status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}