import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClubByLeaderId } from "@/lib/club";
import { getMeetingsByClub } from "@/lib/meetings";
import { db } from "@/db";
import { books, chapters, meetingChapters, meetings, archivedBooks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import AddBookForm from "@/components/AddBookForm";
import CreateMeetingForm from "@/components/CreateMeetingForm";
import StartMeetingButton from "@/components/StartMeetingButton";
import ArchiveBookButton from "@/components/ArchiveBookButton";
import LeaderTopBar from "@/components/LeaderTopBar";

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
    ? await db.select().from(chapters).where(eq(chapters.bookId, book.id)).orderBy(chapters.order)
    : [];

  const clubMeetings = book ? await getMeetingsByClub(club.id) : [];

  const assignedChapterIds: string[] = book
    ? (
        await db
          .select({ chapterId: meetingChapters.chapterId })
          .from(meetingChapters)
          .innerJoin(meetings, eq(meetingChapters.meetingId, meetings.id))
          .where(eq(meetings.bookId, book.id))
      ).map((r) => r.chapterId)
    : [];

  const archived = await db
    .select()
    .from(archivedBooks)
    .where(eq(archivedBooks.clubId, club.id))
    .orderBy(archivedBooks.archivedAt);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  function statusLabel(status: string) {
    if (status === "upcoming") return { text: "Upcoming", cls: "badge" };
    if (status === "started") return { text: "In progress", cls: "badge badge-active" };
    if (status === "voting") return { text: "Voting", cls: "badge badge-active" };
    if (status === "discussing") return { text: "Discussing", cls: "badge badge-active" };
    return { text: "Finished", cls: "badge" };
  }

  return (
    <div className="page">
      <LeaderTopBar
        clubName={club.name}
        userName={session.user.name ?? undefined}
        memberLink={book ? club.memberLink : undefined}
        appUrl={appUrl}
      />

      <div className="page-content">
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p className="label" style={{ marginBottom: 6 }}>Club</p>
          <h1 style={{ fontSize: 32, color: "var(--forest)" }}>{club.name}</h1>
        </div>

        {!book ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 8, color: "var(--forest)" }}>Add your first book</h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
                Upload an EPUB to get started. Chapters will be parsed automatically.
              </p>
              <AddBookForm />
            </div>
            {archived.length > 0 && (
              <div className="card-muted">
                <p className="label" style={{ marginBottom: 16 }}>Previously read</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {archived.map((b) => (
                    <div key={b.id}>
                      <p style={{ fontWeight: 500 }}>{b.title}</p>
                      {b.author && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.author}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="layout-two-col">
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

              {/* Current book */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <p className="label" style={{ marginBottom: 6 }}>Currently reading</p>
                    <h2 style={{ fontSize: 22, color: "var(--forest)" }}>{book.title}</h2>
                    {book.author && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{book.author}</p>}
                    <p style={{ fontSize: 13, color: "var(--text-light)", marginTop: 6 }}>
                      {bookChapters.length} chapters · {assignedChapterIds.length} assigned
                    </p>
                  </div>
                  <ArchiveBookButton bookId={book.id} />
                </div>
              </div>

              {/* Meetings list */}
              {clubMeetings.length > 0 && (
                <div>
                  <p className="label" style={{ marginBottom: 14 }}>Meetings</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {clubMeetings.map((m) => {
                      const { text, cls } = statusLabel(m.status);
                      return (
                        <div key={m.id} className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div>
                              <p style={{ fontWeight: 500 }}>
                                {new Date(m.meetingDate).toLocaleDateString("en-US", {
                                  weekday: "long", month: "long", day: "numeric",
                                })}
                              </p>
                              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                {new Date(m.meetingDate).toLocaleTimeString("en-US", {
                                  hour: "numeric", minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className={cls}>{text}</span>
                            {m.status === "upcoming" && <StartMeetingButton meetingId={m.id} />}
                            {["started", "voting", "discussing"].includes(m.status) && (
                              <a href={`/meeting/${m.id}`} className="btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>
                                Open meeting
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <CreateMeetingForm
                bookId={book.id}
                chapters={bookChapters}
                assignedChapterIds={assignedChapterIds}
              />
              {archived.length > 0 && (
                <div className="card-muted">
                  <p className="label" style={{ marginBottom: 14 }}>Previously read</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {archived.map((b) => (
                      <div key={b.id} style={{ paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                        <p style={{ fontWeight: 500, fontSize: 14 }}>{b.title}</p>
                        {b.author && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.author}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}