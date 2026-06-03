import { auth } from "@/lib/auth";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createMeeting } from "@/lib/meetings";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookId, chapterIds, meetingDate } = await request.json();

    if (!bookId || !chapterIds?.length || !meetingDate) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.leaderId, session.user.id))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "No club found" }, { status: 404 });
    }

    const meeting = await createMeeting(
      club[0].id,
      bookId,
      chapterIds,
      new Date(meetingDate)
    );

    return NextResponse.json({ meeting });
  } catch (err) {
    console.error("Create meeting error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}