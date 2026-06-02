import { db } from "@/db";
import { clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function getClubByLeaderId(leaderId: string) {
  const result = await db
    .select()
    .from(clubs)
    .where(eq(clubs.leaderId, leaderId))
    .limit(1);

  return result[0] ?? null;
}

export async function createClub(leaderId: string, name: string) {
  const memberLink = nanoid(10); // e.g. "aB3xQ2mN9k"

  const result = await db
    .insert(clubs)
    .values({
      leaderId,
      name,
      memberLink,
    })
    .returning();

  return result[0];
}