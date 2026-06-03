import { db } from "@/db";
import { memberAttendance } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { meetingId, memberId, markedAttending, markedReading } =
      await request.json();

    if (!meetingId || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(memberAttendance)
      .where(
        and(
          eq(memberAttendance.meetingId, meetingId),
          eq(memberAttendance.memberId, memberId)
        )
      )
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(memberAttendance)
        .set({ markedAttending, markedReading })
        .where(eq(memberAttendance.id, existing[0].id))
        .returning();
      return NextResponse.json({ attendance: updated[0] });
    } else {
      const created = await db
        .insert(memberAttendance)
        .values({ meetingId, memberId, markedAttending, markedReading })
        .returning();
      return NextResponse.json({ attendance: created[0] });
    }
  } catch (err) {
    console.error("Attendance error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}