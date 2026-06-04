import { auth } from "@/lib/auth";
import { db } from "@/db";
import { books, clubs, archivedBooks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookId } = await request.json();

    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.leaderId, session.user.id))
      .limit(1);

    if (!club[0]) {
      return NextResponse.json({ error: "No club found" }, { status: 404 });
    }

    const book = await db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.clubId, club[0].id)))
      .limit(1);

    if (!book[0]) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Mark book inactive
    await db
      .update(books)
      .set({ isActive: false })
      .where(eq(books.id, bookId));

    // Save to archive
    await db.insert(archivedBooks).values({
      clubId: club[0].id,
      title: book[0].title,
      author: book[0].author,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Archive book error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}