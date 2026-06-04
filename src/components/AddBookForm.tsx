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
      const uploadRes = await fetch("/api/upload-epub", { method: "POST", body: formData });
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        border: "2px dashed var(--border)",
        borderRadius: 8,
        padding: "28px 24px",
        textAlign: "center",
        background: "var(--bg-muted)",
        transition: "border-color 0.15s",
      }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
          Upload an EPUB file
        </p>
        <input
          type="file"
          accept=".epub"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          style={{ fontSize: 13, color: "var(--text-muted)" }}
        />
        {file && (
          <p style={{ fontSize: 12, color: "var(--sage-dark)", marginTop: 8 }}>
            {file.name}
          </p>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" disabled={loading || !file} className="btn-primary">
        {loading ? "Uploading and parsing..." : "Add book"}
      </button>
    </form>
  );
}