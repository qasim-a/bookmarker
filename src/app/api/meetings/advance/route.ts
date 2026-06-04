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

    const { meetingId, action } = await request.json();
    // action: "end_voting" | "next_question" | "end_meeting"

    if (!meetingId || !action) {
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

    const meeting = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
      .limit(1);

    if (!meeting[0]) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // ── END VOTING → start discussion ────────────────────────────────────────
    if (action === "end_voting") {
      if (meeting[0].status !== "voting") {
        return NextResponse.json({ error: "Meeting is not in voting phase" }, { status: 400 });
      }

      // Get all questions ordered by votes desc, then createdAt asc (tie-break: first added)
      const allQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.meetingId, meetingId));

      if (allQuestions.length === 0) {
        return NextResponse.json({ error: "No questions to discuss" }, { status: 400 });
      }

      const sorted = allQuestions.sort((a, b) => {
        const voteDiff = (b.votes ?? 0) - (a.votes ?? 0);
        if (voteDiff !== 0) return voteDiff;
        // tie-break: earlier createdAt wins
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      });

      const top = sorted.slice(0, 3);

      // Clear any existing selection
      await db
        .update(questions)
        .set({ isSelected: false, order: null })
        .where(eq(questions.meetingId, meetingId));

      // Mark top questions as selected with order
      for (let i = 0; i < top.length; i++) {
        await db
          .update(questions)
          .set({ isSelected: true, order: i })
          .where(eq(questions.id, top[i].id));
      }

      await db
        .update(meetings)
        .set({ status: "discussing", currentQuestionIndex: 0 })
        .where(eq(meetings.id, meetingId));

      // Return the selected questions so leader view can update immediately
      const selectedQuestions = top.map((q, i) => ({ ...q, isSelected: true, order: i }));
      return NextResponse.json({ status: "discussing", currentQuestionIndex: 0, selectedQuestions });
    }

    // ── NEXT QUESTION ─────────────────────────────────────────────────────────
    if (action === "next_question") {
      if (meeting[0].status !== "discussing") {
        return NextResponse.json({ error: "Meeting is not in discussion phase" }, { status: 400 });
      }

      const selectedQuestions = await db
        .select()
        .from(questions)
        .where(and(eq(questions.meetingId, meetingId), eq(questions.isSelected, true)));

      const nextIndex = (meeting[0].currentQuestionIndex ?? 0) + 1;

      if (nextIndex >= selectedQuestions.length) {
        // All questions done — move to finished
        await db
          .update(meetings)
          .set({ status: "finished", currentQuestionIndex: nextIndex })
          .where(eq(meetings.id, meetingId));
        return NextResponse.json({ status: "finished" });
      }

      await db
        .update(meetings)
        .set({ currentQuestionIndex: nextIndex })
        .where(eq(meetings.id, meetingId));

      return NextResponse.json({ status: "discussing", currentQuestionIndex: nextIndex });
    }

    // ── END MEETING (manual) ─────────────────────────────────────────────────
    if (action === "end_meeting") {
      await db
        .update(meetings)
        .set({ status: "finished" })
        .where(eq(meetings.id, meetingId));
      return NextResponse.json({ status: "finished" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Advance meeting error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}