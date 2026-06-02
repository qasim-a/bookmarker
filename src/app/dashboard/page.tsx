import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClubByLeaderId } from "@/lib/club";
import { db } from "@/db";
import { books, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import AddBookForm from "@/components/AddBookForm";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const club = await getClubByLeaderId(session.user.id);
  if (!club) redirect("/onboarding");

  const activeBook = await db
    .select()
    .from(books)
    .where(and(eq(books.clubId, club.id), eq(books.isActive, true)))
    .limit(1);

  const book = activeBook[0] ?? null;

  const bookChapters = book
    ? await db
        .select()
        .from(chapters)
        .where(eq(chapters.bookId, book.id))
        .orderBy(chapters.order)
    : [];

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{club.name}</h1>
        <p className="text-sm text-gray-500">{session.user.name}</p>
      </div>

      {!book ? (
        <AddBookForm />
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{book.title}</h2>
            {book.author && <p className="text-sm text-gray-500">{book.author}</p>}
          </div>
          <div>
            <h3 className="font-medium mb-2">Chapters ({bookChapters.length})</h3>
            <ul className="space-y-1">
                {bookChapters.map((c) => (
                    <li key={c.id} className="text-sm text-gray-700">
                        {c.title}
                    </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}