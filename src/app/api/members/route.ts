import { db } from "@/db";
import { members, clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, memberLink } = await request.json();

    if (!name || !memberLink) {
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

    const member = await db
      .insert(members)
      .values({ clubId: club[0].id, name: name.trim() })
      .returning();

    return NextResponse.json({ member: member[0] });
  } catch (err) {
    console.error("Create member error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}