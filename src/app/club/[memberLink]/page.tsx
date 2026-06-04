import { db } from "@/db";
import { clubs, books, members, memberAttendance, meetings, meetingChapters, chapters } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import MemberView from "@/components/MemberView";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ memberLink: string }>;
}) {
  const { memberLink } = await params;

  const club = await db
    .select()
    .from(clubs)
    .where(eq(clubs.memberLink, memberLink))
    .limit(1);

  if (!club[0]) notFound();

  const activeBook = await db
    .select()
    .from(books)
    .where(and(eq(books.clubId, club[0].id), eq(books.isActive, true)))
    .limit(1);

  const book = activeBook[0] ?? null;

  // Active meeting: started/voting/discussing — members get routed into it
  const activeMeetingResult = book
    ? await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.clubId, club[0].id),
            inArray(meetings.status, ["started", "voting", "discussing"])
          )
        )
        .limit(1)
    : null;

  const activeMeeting = activeMeetingResult?.[0] ?? null;

  // All upcoming meetings for the home view
  const upcomingMeetings = book
    ? await db
        .select()
        .from(meetings)
        .where(and(eq(meetings.clubId, club[0].id), eq(meetings.status, "upcoming")))
        .orderBy(meetings.meetingDate)
    : [];

  // Chapters for the active meeting (AI summary on started phase)
  const assignedChapters = activeMeeting
    ? await db
        .select({ id: chapters.id, title: chapters.title, order: chapters.order })
        .from(meetingChapters)
        .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
        .where(eq(meetingChapters.meetingId, activeMeeting.id))
        .orderBy(chapters.order)
    : [];

  // Chapters for each upcoming meeting (shown on home view)
  const upcomingChapters =
    upcomingMeetings.length > 0
      ? await db
          .select({
            meetingId: meetingChapters.meetingId,
            id: chapters.id,
            title: chapters.title,
            order: chapters.order,
          })
          .from(meetingChapters)
          .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
          .where(
            inArray(
              meetingChapters.meetingId,
              upcomingMeetings.map((m) => m.id)
            )
          )
          .orderBy(chapters.order)
      : [];

  const clubMembers = await db
    .select()
    .from(members)
    .where(eq(members.clubId, club[0].id))
    .orderBy(members.name);

  // Attendance for the active meeting (used in started phase)
  const attendance = activeMeeting
    ? await db
        .select()
        .from(memberAttendance)
        .where(eq(memberAttendance.meetingId, activeMeeting.id))
    : [];

  // Attendance for all upcoming meetings (shown on home view per-meeting)
  const upcomingAttendanceRaw =
    upcomingMeetings.length > 0
      ? await db
          .select()
          .from(memberAttendance)
          .where(
            inArray(
              memberAttendance.meetingId,
              upcomingMeetings.map((m) => m.id)
            )
          )
      : [];

  // Attach meetingId to each attendance record for the home view
  const upcomingAttendance = upcomingAttendanceRaw.map((a) => ({
    ...a,
    meetingId: a.meetingId,
  }));

  return (
    <MemberView
      club={club[0]}
      book={book}
      activeMeeting={activeMeeting}
      upcomingMeetings={upcomingMeetings}
      upcomingChapters={upcomingChapters}
      upcomingAttendance={upcomingAttendance}
      assignedChapters={assignedChapters}
      members={clubMembers}
      attendance={attendance}
    />
  );
}