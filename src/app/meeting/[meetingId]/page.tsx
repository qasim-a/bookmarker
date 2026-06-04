import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { meetings, meetingChapters, chapters, books, clubs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import MeetingLeaderView from "../../../components/MeetingLeaderView";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { meetingId } = await params;

  const club = await db
    .select()
    .from(clubs)
    .where(eq(clubs.leaderId, session.user.id))
    .limit(1);

  if (!club[0]) redirect("/dashboard");

  const meeting = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.clubId, club[0].id)))
    .limit(1);

  if (!meeting[0]) notFound();

  const book = await db
    .select()
    .from(books)
    .where(eq(books.id, meeting[0].bookId))
    .limit(1);

  const assignedChapters = await db
    .select({ id: chapters.id, title: chapters.title, order: chapters.order })
    .from(meetingChapters)
    .innerJoin(chapters, eq(meetingChapters.chapterId, chapters.id))
    .where(eq(meetingChapters.meetingId, meetingId))
    .orderBy(chapters.order);

  return (
    <MeetingLeaderView
      meeting={meeting[0]}
      book={book[0]}
      assignedChapters={assignedChapters}
      clubMemberLink={club[0].memberLink}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
    />
  );
}