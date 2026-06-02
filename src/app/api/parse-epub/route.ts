import { auth } from "@/lib/auth";
import { db } from "@/db";
import { books, chapters, clubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseEpub } from "@/lib/epub";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookId } = await request.json();

    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.leaderId, session.user.id))
      .limit(1);

    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book[0] || book[0].clubId !== club[0].id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    console.time("fetch+parse");
    const parsed = await parseEpub(book[0].epubPath);
    console.timeEnd("fetch+parse");

    // Update book with metadata from epub
    await db
      .update(books)
      .set({
        title: parsed.title,
        author: parsed.author,
      })
      .where(eq(books.id, book[0].id));
      
    console.time("db insert");

    const inserted = await db
      .insert(chapters)
      .values(
        parsed.chapters.map((c) => ({
          bookId: book[0].id,
          title: c.title,
          order: c.order,
          content: c.content,
        }))
      )
      .returning();
    console.timeEnd("db insert");


    return NextResponse.json({ chapters: inserted, title: parsed.title, author: parsed.author });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}