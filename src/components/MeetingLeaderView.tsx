"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Meeting = { id: string; status: string; meetingDate: Date };
type Book = { id: string; title: string; author: string | null };
type Chapter = { id: string; title: string; order: number };
type Question = { id: string; text: string; source: string; votes: number | null; isSelected: boolean | null; order: number | null; createdAt?: string | null };
type Props = { meeting: Meeting; book: Book; assignedChapters: Chapter[]; clubMemberLink: string; appUrl: string };
type Phase = "started" | "voting" | "discussing" | "finished";

const DISC_SECS = 10 * 60;
const VOTE_SECS = 5 * 60;

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function MeetingLeaderView({ meeting, book, assignedChapters, clubMemberLink, appUrl }: Props) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(() => {
    const s = meeting.status;
    if (s === "voting") return "voting";
    if (s === "discussing") return "discussing";
    if (s === "finished") return "finished";
    return "started";
  });

  const [aiEnabled, setAiEnabled] = useState(true);
  const [startingVoting, setStartingVoting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [votingQuestions, setVotingQuestions] = useState<Question[]>([]);
  const [voteTimer, setVoteTimer] = useState(VOTE_SECS);
  const [voteRunning, setVoteRunning] = useState(false);
  const [endingVoting, setEndingVoting] = useState(false);

  const [discussionQuestions, setDiscussionQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [discTimer, setDiscTimer] = useState(DISC_SECS);
  const [discRunning, setDiscRunning] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [endingMeeting, setEndingMeeting] = useState(false);

  // Timers
  useEffect(() => {
    if (!voteRunning || phase !== "voting") return;
    if (voteTimer <= 0) { setVoteRunning(false); return; }
    const t = setInterval(() => setVoteTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [voteRunning, voteTimer, phase]);

  useEffect(() => {
    if (!discRunning || phase !== "discussing") return;
    if (discTimer <= 0) { setDiscRunning(false); return; }
    const t = setInterval(() => setDiscTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [discRunning, discTimer, phase]);

  // Poll votes during voting
  useEffect(() => {
    if (phase !== "voting") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/meeting-status?meetingId=${meeting.id}&memberLink=${clubMemberLink}`);
      const data = await res.json();
      if (data.questions?.length) setVotingQuestions(data.questions);
    }, 5000);
    return () => clearInterval(interval);
  }, [phase, meeting.id, clubMemberLink]);

  // Restore state on reload
  useEffect(() => {
    if (phase !== "voting" && phase !== "discussing") return;
    async function restore() {
      const res = await fetch(`/api/meeting-status?meetingId=${meeting.id}&memberLink=${clubMemberLink}`);
      const data = await res.json();
      if (data.status === "voting" && data.questions) { setVotingQuestions(data.questions); setVoteRunning(true); }
      if (data.status === "discussing" && data.questions) { setDiscussionQuestions(data.questions); setCurrentIndex(data.currentQuestionIndex ?? 0); setDiscRunning(true); }
    }
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartVoting() {
    setStartingVoting(true); setStartError(null);
    try {
      const res = await fetch("/api/meetings/start-voting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, aiEnabled }),
      });
      const data = await res.json();
      if (!res.ok) { setStartError(data.error ?? "Something went wrong."); return; }
      setVotingQuestions(data.questions ?? []);
      setPhase("voting"); setVoteTimer(VOTE_SECS); setVoteRunning(true);
    } finally { setStartingVoting(false); }
  }

  async function handleEndVoting() {
    if (!votingQuestions.length) return;
    setEndingVoting(true);
    try {
      const res = await fetch("/api/meetings/advance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, action: "end_voting" }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setDiscussionQuestions(data.selectedQuestions ?? []);
      setCurrentIndex(0); setDiscTimer(DISC_SECS); setDiscRunning(true); setPhase("discussing");
    } finally { setEndingVoting(false); }
  }

  async function handleNext() {
    setAdvancing(true); setAiInsight(null);
    try {
      const isLast = currentIndex >= discussionQuestions.length - 1;
      const res = await fetch("/api/meetings/advance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, action: isLast ? "end_meeting" : "next_question" }),
      });
      const data = await res.json();
      if (!res.ok) return;
      if (data.status === "finished") { setPhase("finished"); return; }
      setCurrentIndex(data.currentQuestionIndex); setDiscTimer(DISC_SECS); setDiscRunning(true);
    } finally { setAdvancing(false); }
  }

  async function handleEndMeeting() {
    setEndingMeeting(true);
    try {
      await fetch("/api/meetings/advance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, action: "end_meeting" }),
      });
      setPhase("finished");
    } finally { setEndingMeeting(false); }
  }

  async function fetchInsight() {
    const q = discussionQuestions[currentIndex];
    if (!q) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/insight", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, question: q.text }),
      });
      const data = await res.json();
      if (res.ok) setAiInsight(data.insight);
    } finally { setInsightLoading(false); }
  }

  const currentQuestion = discussionQuestions[currentIndex] ?? null;

  // ── Shared top bar for meeting pages ──────────────────────────────────────
  const MeetingTopBar = ({ showEndMeeting = false }: { showEndMeeting?: boolean }) => (
    <header className="topbar">
      <span className="topbar-brand">Bookmarker</span>
      <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />
      <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{book.title}</span>
      <div className="topbar-spacer" />
      <nav className="topbar-nav">
        {showEndMeeting && phase !== "finished" && (
          <button onClick={handleEndMeeting} disabled={endingMeeting} className="btn-danger">
            {endingMeeting ? "Ending..." : "End meeting"}
          </button>
        )}
        <a href="/dashboard" className="btn-ghost">Dashboard</a>
      </nav>
    </header>
  );

  // ── STARTED ───────────────────────────────────────────────────────────────
  if (phase === "started") {
    return (
      <div className="page">
        <MeetingTopBar showEndMeeting />
        <div className="page-content-narrow">
          <div style={{ marginBottom: 40 }}>
            <p className="label" style={{ marginBottom: 6 }}>Meeting room open</p>
            <h1 style={{ fontSize: 28, color: "var(--forest)" }}>{book.title}</h1>
            {book.author && <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{book.author}</p>}
            <p style={{ fontSize: 13, color: "var(--text-light)", marginTop: 8 }}>
              {assignedChapters.map(c => c.title).join("  ·  ")}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card-muted" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontWeight: 500, marginBottom: 2 }}>AI discussion questions</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Generate 5 questions from the assigned chapters
                </p>
              </div>
              <button
                onClick={() => setAiEnabled(v => !v)}
                className={`toggle ${aiEnabled ? "toggle-on" : "toggle-off"}`}
                aria-label="Toggle AI questions"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {startError && <div className="error-box">{startError}</div>}

            <button onClick={handleStartVoting} disabled={startingVoting} className="btn-primary" style={{ padding: "14px 24px", fontSize: 15 }}>
              {startingVoting ? (aiEnabled ? "Generating questions..." : "Starting voting...") : "Start voting"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VOTING ────────────────────────────────────────────────────────────────
  if (phase === "voting") {
    return (
      <div className="page">
        <MeetingTopBar showEndMeeting />
        <div className="page-content">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 48, alignItems: "start" }}>
            <div>
              <div style={{ marginBottom: 32 }}>
                <p className="label" style={{ marginBottom: 6 }}>Voting phase</p>
                <h1 style={{ fontSize: 26, color: "var(--forest)" }}>{book.title}</h1>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                  Members are voting. Votes are hidden until you end voting.
                </p>
              </div>

              {votingQuestions.length === 0 ? (
                <div className="card-muted" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No questions yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {votingQuestions.map(q => (
                    <div key={q.id} className="question-card" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                      <p style={{ fontSize: 15, lineHeight: 1.5, flex: 1 }}>{q.text}</p>
                      <span className="badge" style={{ flexShrink: 0 }}>{q.source === "ai" ? "AI" : "Member"}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <button onClick={handleEndVoting} disabled={endingVoting || votingQuestions.length === 0} className="btn-primary" style={{ padding: "12px 28px" }}>
                  {endingVoting ? "Selecting top questions..." : "End voting"}
                </button>
              </div>
            </div>

            <div style={{ position: "sticky", top: 80 }}>
              <div className="card-muted" style={{ textAlign: "center" }}>
                <p className="label" style={{ marginBottom: 12 }}>Timer</p>
                <p className="timer">{fmt(voteTimer)}</p>
                <button onClick={() => setVoteRunning(r => !r)} className="btn-ghost" style={{ marginTop: 12 }}>
                  {voteRunning ? "Pause" : "Resume"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DISCUSSING ────────────────────────────────────────────────────────────
  if (phase === "discussing") {
    return (
      <div className="page">
        <MeetingTopBar showEndMeeting />
        <div className="page-content">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 48, alignItems: "start" }}>

            {/* Main */}
            <div>
              <p className="label" style={{ marginBottom: 16 }}>
                Question {currentIndex + 1} of {discussionQuestions.length}
              </p>

              {currentQuestion ? (
                <div className="card question-card-active fade-in" style={{ padding: "28px 32px", marginBottom: 24 }}>
                  <p style={{ fontSize: 20, lineHeight: 1.55, color: "var(--forest)" }}>{currentQuestion.text}</p>
                </div>
              ) : (
                <div className="card-muted" style={{ padding: "28px 32px", marginBottom: 24 }}>
                  <p style={{ color: "var(--text-muted)" }}>Loading question...</p>
                </div>
              )}

              {aiInsight && (
                <div className="card-muted fade-in" style={{ marginBottom: 24 }}>
                  <p className="label" style={{ marginBottom: 10 }}>AI insight</p>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>{aiInsight}</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={fetchInsight} disabled={insightLoading} className="btn-secondary">
                  {insightLoading ? "Thinking..." : "Get AI insight"}
                </button>
                <button onClick={handleNext} disabled={advancing} className="btn-primary">
                  {advancing ? "..." : currentIndex >= discussionQuestions.length - 1 ? "End meeting" : "Next question"}
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card-muted" style={{ textAlign: "center" }}>
                <p className="label" style={{ marginBottom: 12 }}>Timer</p>
                <p className="timer">{fmt(discTimer)}</p>
                <button onClick={() => setDiscRunning(r => !r)} className="btn-ghost" style={{ marginTop: 12 }}>
                  {discRunning ? "Pause" : "Resume"}
                </button>
              </div>

              {discussionQuestions.length > 1 && (
                <div className="card">
                  <p className="label" style={{ marginBottom: 14 }}>All questions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {discussionQuestions.map((q, i) => (
                      <div key={q.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: i === currentIndex ? "var(--forest)" : "var(--text-light)",
                          minWidth: 16, paddingTop: 2,
                        }}>
                          {i + 1}
                        </span>
                        <p style={{
                          fontSize: 13, lineHeight: 1.45,
                          color: i === currentIndex ? "var(--forest)" : "var(--text-muted)",
                          fontWeight: i === currentIndex ? 500 : 400,
                        }}>
                          {q.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── FINISHED ──────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar-brand">Bookmarker</span>
        <div className="topbar-spacer" />
      </header>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, textAlign: "center" }}>
        <p className="label" style={{ marginBottom: 4 }}>Meeting complete</p>
        <h1 style={{ fontSize: 32, color: "var(--forest)" }}>{book.title}</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Great discussion.</p>
        <button onClick={() => { router.push("/dashboard"); router.refresh(); }} className="btn-primary" style={{ padding: "12px 32px" }}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}