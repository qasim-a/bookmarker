import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { books, clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.leaderId, session.user.id))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "No club found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = await put(`epubs/${club[0].id}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Save with placeholder title — will be updated after parsing
    const book = await db
      .insert(books)
      .values({
        clubId: club[0].id,
        title: file.name,
        epubPath: blob.url,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ book: book[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}