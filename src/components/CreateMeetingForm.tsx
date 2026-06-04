"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Chapter = { id: string; title: string; order: number };
type Props = { bookId: string; chapters: Chapter[]; assignedChapterIds: string[] };

export default function CreateMeetingForm({ bookId, chapters, assignedChapterIds }: Props) {
  const router = useRouter();
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [meetingDate, setMeetingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleChapter(id: string) {
    if (assignedChapterIds.includes(id)) return;
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChapters.length || !meetingDate) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapterIds: selectedChapters, meetingDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
      setSelectedChapters([]);
      setMeetingDate("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const available = chapters.filter((c) => !assignedChapterIds.includes(c.id));

  return (
    <div className="card">
      <p className="label" style={{ marginBottom: 16 }}>Schedule a meeting</p>

      {available.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          All chapters have been assigned to meetings.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
              Select chapters
            </p>
            <div style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              padding: "4px 0",
            }}>
              {chapters.map((c) => {
                const assigned = assignedChapterIds.includes(c.id);
                const selected = selectedChapters.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 14px",
                      cursor: assigned ? "not-allowed" : "pointer",
                      opacity: assigned ? 0.35 : 1,
                      background: selected ? "var(--bg-muted)" : "transparent",
                      transition: "background 0.1s",
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleChapter(c.id)}
                      disabled={assigned}
                    />
                    <span style={{ flex: 1 }}>{c.title}</span>
                    {assigned && (
                      <span style={{ fontSize: 11, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        assigned
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Date and time</p>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input"
              required
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button
            type="submit"
            disabled={loading || !selectedChapters.length || !meetingDate}
            className="btn-primary"
          >
            {loading ? "Scheduling..." : `Schedule${selectedChapters.length > 0 ? ` (${selectedChapters.length} chapters)` : ""}`}
          </button>
        </form>
      )}
    </div>
  );
}