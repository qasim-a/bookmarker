"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddBookForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload-epub", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      const parseRes = await fetch("/api/parse-epub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: uploadData.book.id }),
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error);

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-sm">
      <h2 className="text-lg font-semibold">Add a book</h2>
      <input
        type="file"
        accept=".epub"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-sm"
        required
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
      >
        {loading ? "Uploading & parsing..." : "Add Book"}
      </button>
    </form>
  );
}