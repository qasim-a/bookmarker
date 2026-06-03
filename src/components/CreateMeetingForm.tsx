"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Chapter = {
  id: string;
  title: string;
  order: number;
};

type Props = {
  bookId: string;
  chapters: Chapter[];
};

export default function CreateMeetingForm({ bookId, chapters }: Props) {
  const router = useRouter();
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [meetingDate, setMeetingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleChapter(id: string) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Schedule a meeting</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Select chapters for this meeting</p>
          <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-3">
            {chapters.map((chapter) => (
              <label
                key={chapter.id}
                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(chapter.id)}
                  onChange={() => toggleChapter(chapter.id)}
                  className="rounded"
                />
                {chapter.title}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Meeting date</p>
          <input
            type="datetime-local"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !selectedChapters.length || !meetingDate}
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
        >
          {loading ? "Scheduling..." : `Schedule meeting (${selectedChapters.length} chapters)`}
        </button>
      </form>
    </div>
  );
}