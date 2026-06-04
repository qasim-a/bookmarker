"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      if (res.ok) router.push(`/meeting/${meetingId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleStart} disabled={loading} className="btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>
      {loading ? "Starting..." : "Start meeting"}
    </button>
  );
}