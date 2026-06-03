import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClubByLeaderId } from "@/lib/club";
import { getMeetingsByClub } from "@/lib/meetings";
import { db } from "@/db";
import { books, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import AddBookForm from "@/components/AddBookForm";
import CreateMeetingForm from "@/components/CreateMeetingForm";
import SignOutButton from "@/components/SignOutButton";


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

  const clubMeetings = book ? await getMeetingsByClub(club.id) : [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const memberLinkUrl = `${appUrl}/club/${club.memberLink}`;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{club.name}</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">{session.user.name}</p>
          <SignOutButton />
        </div>
      </div>

      {book && (
        <div className="text-sm text-gray-400">
          Member link:{" "}
          <span className="font-mono">{memberLinkUrl}</span>
        </div>
      )}

      {!book ? (
        <AddBookForm />
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold">{book.title}</h2>
            {book.author && (
              <p className="text-sm text-gray-500">{book.author}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              {bookChapters.length} chapters
            </p>
          </div>

          <CreateMeetingForm bookId={book.id} chapters={bookChapters} />

          {clubMeetings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Meetings</h2>
              <ul className="space-y-2">
                {clubMeetings.map((m) => (
                  <li
                    key={m.id}
                    className="border rounded-lg px-4 py-3 text-sm flex justify-between items-center"
                  >
                    <span>
                      {new Date(m.meetingDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 capitalize">
                        {m.status}
                      </span>
                      {m.status !== "finished" && (
                        <a
                          href={`/meeting/${m.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}