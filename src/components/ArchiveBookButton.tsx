"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ArchiveBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    setLoading(true);
    try {
      const res = await fetch("/api/books/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        router.refresh();
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Archive this book?</span>
        <button onClick={handleArchive} disabled={loading} className="btn-danger">
          {loading ? "Archiving..." : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="btn-ghost">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="btn-ghost" style={{ fontSize: 13 }}>
      Archive book
    </button>
  );
}