import { db } from "@/db";
import { meetings, meetingChapters } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createMeeting(
  clubId: string,
  bookId: string,
  chapterIds: string[],
  meetingDate: Date
) {
  const meeting = await db
    .insert(meetings)
    .values({
      clubId,
      bookId,
      meetingDate,
      status: "upcoming",
    })
    .returning();

  await db.insert(meetingChapters).values(
    chapterIds.map((chapterId) => ({
      meetingId: meeting[0].id,
      chapterId,
    }))
  );

  return meeting[0];
}

export async function getMeetingsByClub(clubId: string) {
  return await db
    .select()
    .from(meetings)
    .where(eq(meetings.clubId, clubId))
    .orderBy(meetings.meetingDate);
}

export async function getMeetingWithChapters(meetingId: string) {
  const meeting = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting[0]) return null;

  const assigned = await db
    .select()
    .from(meetingChapters)
    .where(eq(meetingChapters.meetingId, meetingId));

  return { ...meeting[0], chapterIds: assigned.map((a) => a.chapterId) };
}