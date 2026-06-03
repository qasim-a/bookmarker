import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetings, questions, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId, status, selectedQuestionIds, currentQuestionIndex } =
      await request.json();

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

    if (status === "discussing" && selectedQuestionIds?.length) {
      await db
        .update(questions)
        .set({ isSelected: false, order: null })
        .where(eq(questions.meetingId, meetingId));

      for (let i = 0; i < selectedQuestionIds.length; i++) {
        await db
          .update(questions)
          .set({ isSelected: true, order: i })
          .where(eq(questions.id, selectedQuestionIds[i]));
      }
    }

    const updateData: Record<string, unknown> = { status };
    if (currentQuestionIndex !== undefined) {
      updateData.currentQuestionIndex = currentQuestionIndex;
    }

    const updated = await db
      .update(meetings)
      .set(updateData)
      .where(eq(meetings.id, meetingId))
      .returning();

      return NextResponse.json({ 
        status: meeting[0].status,
        currentQuestionIndex: meeting[0].currentQuestionIndex ?? 0,
      });
  } catch (err) {
    console.error("Update meeting status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}