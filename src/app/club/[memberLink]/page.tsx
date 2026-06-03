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

  const activeMeeting = book
    ? await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.clubId, club[0].id),
            inArray(meetings.status, ["upcoming", "voting", "discussing"])
          )
        )
        .limit(1)
    : null;

  const meeting = activeMeeting?.[0] ?? null;

  const assignedChapters = meeting
    ? await db
        .select({ id: chapters.id, title: chapters.title, order: chapters.order })
        .from(meetingChapters)
        .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
        .where(eq(meetingChapters.meetingId, meeting.id))
        .orderBy(chapters.order)
    : [];

  const clubMembers = await db
    .select()
    .from(members)
    .where(eq(members.clubId, club[0].id))
    .orderBy(members.name);

  const attendance = meeting
    ? await db
        .select()
        .from(memberAttendance)
        .where(eq(memberAttendance.meetingId, meeting.id))
    : [];

  return (
    <MemberView
      club={club[0]}
      book={book}
      meeting={meeting}
      assignedChapters={assignedChapters}
      members={clubMembers}
      attendance={attendance}
    />
  );
}