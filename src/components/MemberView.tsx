"use client";

import { useState, useEffect } from "react";

type Club = { id: string; name: string; memberLink: string };
type Book = { id: string; title: string; author: string | null } | null;
type Meeting = { id: string; meetingDate: Date; status: string };
type Chapter = { id: string; title: string; order: number };
type UpcomingChapter = { meetingId: string; id: string; title: string; order: number };
type Member = { id: string; name: string };
type Attendance = { memberId: string; markedAttending: boolean | null; markedReading: boolean | null };
type MeetingAttendance = Attendance & { meetingId: string };
type Question = { id: string; text: string; source: string; votes: number | null; isSelected: boolean | null; order: number | null };

type Props = {
  club: Club; book: Book;
  activeMeeting: Meeting | null;
  upcomingMeetings: Meeting[];
  upcomingChapters: UpcomingChapter[];
  upcomingAttendance: MeetingAttendance[];
  assignedChapters: Chapter[];
  members: Member[];
  attendance: Attendance[];
};

type Phase = "home" | "started" | "voting" | "discussing" | "finished";

export default function MemberView({ club, book, activeMeeting, upcomingMeetings, upcomingChapters, upcomingAttendance, assignedChapters, members, attendance }: Props) {

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState<Member[]>(members);
  const [newName, setNewName] = useState("");
  const [showNewMember, setShowNewMember] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);

  const [localAttendance, setLocalAttendance] = useState<Attendance[]>(attendance);
  const [upcomingLocalAttendance, setUpcomingLocalAttendance] = useState<MeetingAttendance[]>(upcomingAttendance);

  const [phase, setPhase] = useState<Phase>(() => {
    if (!activeMeeting) return "home";
    const s = activeMeeting.status;
    if (s === "started") return "started";
    if (s === "voting") return "voting";
    if (s === "discussing") return "discussing";
    return "home";
  });

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [memberQuestion, setMemberQuestion] = useState("");
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  const [votingQuestions, setVotingQuestions] = useState<Question[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [discussionQuestions, setDiscussionQuestions] = useState<Question[]>([]);

  const myAttendance = localAttendance.find(a => a.memberId === selectedMemberId);
  const memberName = localMembers.find(m => m.id === selectedMemberId)?.name;

  useEffect(() => {
    if (!activeMeeting || !selectedMemberId) return;
    async function poll() {
      const res = await fetch(`/api/meeting-status?meetingId=${activeMeeting!.id}&memberLink=${club.memberLink}&memberId=${selectedMemberId}`);
      if (!res.ok) return;
      const data = await res.json();
      const p: Phase = data.status === "started" ? "started" : data.status === "voting" ? "voting" : data.status === "discussing" ? "discussing" : data.status === "finished" ? "finished" : "home";
      setPhase(p);
      if (p === "voting") { if (data.questions?.length) setVotingQuestions(data.questions); if (data.likedIds) setLikedIds(data.likedIds); }
      if (p === "discussing" || p === "finished") { if (data.questions?.length) setDiscussionQuestions(data.questions); }
    }
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [activeMeeting, selectedMemberId, club.memberLink]);

  useEffect(() => {
    if (activeMeeting || !selectedMemberId) return;
    const t = setInterval(() => { window.location.reload(); }, 5000);
    return () => clearInterval(t);
  }, [activeMeeting, selectedMemberId]);

  async function handleNewMember() {
    if (!newName.trim()) return;
    setJoiningLoading(true);
    try {
      const res = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), memberLink: club.memberLink }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedMemberId(data.member.id);
      setLocalMembers(prev => [...prev, data.member]);
      setShowNewMember(false); setNewName("");
    } catch (err) { console.error(err); } finally { setJoiningLoading(false); }
  }

  async function updateAttendance(field: "markedAttending" | "markedReading", value: boolean) {
    if (!selectedMemberId || !activeMeeting) return;
    const current = myAttendance ?? { memberId: selectedMemberId, markedAttending: false, markedReading: false };
    const updated = { ...current, [field]: value };
    setLocalAttendance(prev => { const e = prev.find(a => a.memberId === selectedMemberId); return e ? prev.map(a => a.memberId === selectedMemberId ? updated : a) : [...prev, updated]; });
    await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: activeMeeting.id, memberId: selectedMemberId, markedAttending: updated.markedAttending, markedReading: updated.markedReading }) });
  }

  async function updateUpcomingAttendance(meetingId: string, field: "markedAttending" | "markedReading", value: boolean) {
    if (!selectedMemberId) return;
    const current = upcomingLocalAttendance.find(a => a.meetingId === meetingId && a.memberId === selectedMemberId) ?? { meetingId, memberId: selectedMemberId, markedAttending: false, markedReading: false };
    const updated = { ...current, [field]: value };
    setUpcomingLocalAttendance(prev => { const e = prev.find(a => a.meetingId === meetingId && a.memberId === selectedMemberId); return e ? prev.map(a => a.meetingId === meetingId && a.memberId === selectedMemberId ? updated : a) : [...prev, updated]; });
    await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId, memberId: selectedMemberId, markedAttending: updated.markedAttending, markedReading: updated.markedReading }) });
  }

  async function fetchSummary() {
    if (!activeMeeting) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: activeMeeting.id, memberLink: club.memberLink }) });
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
    } finally { setSummaryLoading(false); }
  }

  async function handleSubmitQuestion() {
    if (!memberQuestion.trim() || !selectedMemberId || !activeMeeting) return;
    setSubmittingQuestion(true); setSubmitError(null);
    try {
      const res = await fetch("/api/questions/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: activeMeeting.id, memberId: selectedMemberId, text: memberQuestion.trim(), memberLink: club.memberLink }) });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error); return; }
      setQuestionSubmitted(true); setMemberQuestion("");
    } finally { setSubmittingQuestion(false); }
  }

  async function handleLike(questionId: string) {
    if (!selectedMemberId) return;
    const liked = likedIds.includes(questionId);
    setLikedIds(prev => liked ? prev.filter(id => id !== questionId) : [...prev, questionId]);
    setVotingQuestions(prev => prev.map(q => q.id === questionId ? { ...q, votes: (q.votes ?? 0) + (liked ? -1 : 1) } : q));
    const res = await fetch("/api/questions/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, memberId: selectedMemberId, memberLink: club.memberLink }) });
    const data = await res.json();
    if (!res.ok) {
      setLikedIds(prev => liked ? [...prev, questionId] : prev.filter(id => id !== questionId));
      setVotingQuestions(prev => prev.map(q => q.id === questionId ? { ...q, votes: (q.votes ?? 0) + (liked ? 1 : -1) } : q));
    } else {
      setVotingQuestions(prev => prev.map(q => q.id === questionId ? { ...q, votes: data.votes } : q));
    }
  }

  // Top bar for member pages
  const MemberTopBar = () => (
    <header className="topbar">
      <span className="topbar-brand">Bookmarker</span>
      <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />
      <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{club.name}</span>
      <div className="topbar-spacer" />
      {selectedMemberId && (
        <button onClick={() => setSelectedMemberId(null)} className="btn-ghost">
          {memberName} — switch
        </button>
      )}
    </header>
  );

  // ── IDENTITY ──────────────────────────────────────────────────────────────
  if (!selectedMemberId) {
    return (
      <div className="page">
        <header className="topbar">
          <span className="topbar-brand">Bookmarker</span>
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{club.name}</span>
        </header>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 0 }}>
          <div style={{ width: "100%", maxWidth: 400 }}>
            <p className="label" style={{ marginBottom: 8 }}>Welcome to</p>
            <h1 style={{ fontSize: 28, color: "var(--forest)", marginBottom: 4 }}>{club.name}</h1>
            {book && <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>{book.title}</p>}
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Who are you?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {localMembers.map(m => (
                <button key={m.id} onClick={() => setSelectedMemberId(m.id)} className="btn-secondary" style={{ justifyContent: "flex-start" }}>
                  {m.name}
                </button>
              ))}
            </div>
            {!showNewMember ? (
              <button onClick={() => setShowNewMember(true)} className="btn-ghost" style={{ width: "100%", justifyContent: "center", border: "1.5px dashed var(--border)", borderRadius: 6, padding: "10px" }}>
                I'm new here
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" placeholder="Your name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleNewMember()} autoFocus />
                <button onClick={handleNewMember} disabled={joiningLoading || !newName.trim()} className="btn-primary">
                  Join
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (phase === "home") {
    return (
      <div className="page">
        <MemberTopBar />
        <div className="page-content-narrow">
          <div style={{ marginBottom: 32 }}>
            <p className="label" style={{ marginBottom: 6 }}>Currently reading</p>
            {book && <h1 style={{ fontSize: 26, color: "var(--forest)" }}>{book.title}</h1>}
            {book?.author && <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{book.author}</p>}
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="card-muted" style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No upcoming meetings scheduled.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="label">Upcoming meetings</p>
              {upcomingMeetings.map(m => {
                const chaps = upcomingChapters.filter(c => c.meetingId === m.id);
                const myRecord = upcomingLocalAttendance.find(a => a.meetingId === m.id && a.memberId === selectedMemberId);
                return (
                  <div key={m.id} className="card" style={{ display: "flex", gap: 32 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>
                        {new Date(m.meetingDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        {new Date(m.meetingDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      {chaps.length > 0 && (
                        <p style={{ fontSize: 13, color: "var(--text-light)", marginTop: 6 }}>
                          {chaps.map(c => c.title).join("  ·  ")}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                        <input type="checkbox" checked={myRecord?.markedAttending ?? false} onChange={e => updateUpcomingAttendance(m.id, "markedAttending", e.target.checked)} />
                        I'm attending
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                        <input type="checkbox" checked={myRecord?.markedReading ?? false} onChange={e => updateUpcomingAttendance(m.id, "markedReading", e.target.checked)} />
                        Done reading
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── STARTED ───────────────────────────────────────────────────────────────
  if (phase === "started") {
    return (
      <div className="page">
        <MemberTopBar />
        <div className="page-content-narrow">
          <div style={{ marginBottom: 32 }}>
            <p className="label" style={{ marginBottom: 6 }}>Meeting starting</p>
            <h1 style={{ fontSize: 26, color: "var(--forest)" }}>{club.name}</h1>
            {book && <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 14 }}>{book.title}</p>}
          </div>

          {activeMeeting && (
            <div className="card" style={{ marginBottom: 20 }}>
              <p className="label" style={{ marginBottom: 14 }}>Your status</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={myAttendance?.markedAttending ?? false} onChange={e => updateAttendance("markedAttending", e.target.checked)} />
                  I'm attending this meeting
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={myAttendance?.markedReading ?? false} onChange={e => updateAttendance("markedReading", e.target.checked)} />
                  I've finished the assigned reading
                </label>
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 20 }}>
            <p className="label" style={{ marginBottom: 6 }}>Chapter summary</p>
            {assignedChapters.length > 0 && (
              <p style={{ fontSize: 13, color: "var(--text-light)", marginBottom: 14 }}>
                {assignedChapters.map(c => c.title).join("  ·  ")}
              </p>
            )}
            {summary ? (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>{summary}</p>
            ) : (
              <button onClick={fetchSummary} disabled={summaryLoading} className="btn-secondary">
                {summaryLoading ? "Generating summary..." : "Get AI summary"}
              </button>
            )}
          </div>

          <div className="card">
            <p className="label" style={{ marginBottom: 6 }}>Submit a question</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
              One question per member, before voting starts
            </p>
            {questionSubmitted ? (
              <div className="success-box">Question submitted successfully.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea className="textarea" placeholder="What would you like to discuss?" value={memberQuestion} onChange={e => setMemberQuestion(e.target.value)} rows={3} />
                {submitError && <div className="error-box">{submitError}</div>}
                <button onClick={handleSubmitQuestion} disabled={submittingQuestion || !memberQuestion.trim()} className="btn-primary">
                  {submittingQuestion ? "Submitting..." : "Submit question"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── VOTING ────────────────────────────────────────────────────────────────
  if (phase === "voting") {
    return (
      <div className="page">
        <MemberTopBar />
        <div className="page-content-narrow">
          <div style={{ marginBottom: 32 }}>
            <p className="label" style={{ marginBottom: 6 }}>Voting</p>
            <h1 style={{ fontSize: 26, color: "var(--forest)" }}>{club.name}</h1>
            <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 14 }}>
              Like the questions you want to discuss. The top voted will be selected.
            </p>
          </div>

          {votingQuestions.length === 0 ? (
            <div className="card-muted" style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading questions...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {votingQuestions.map(q => {
                const liked = likedIds.includes(q.id);
                return (
                  <button key={q.id} onClick={() => handleLike(q.id)} className={`question-card ${liked ? "question-card-liked" : ""}`} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <div className={`question-card ${liked ? "question-card-liked" : ""}`} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{q.text}</p>
                        {q.source === "ai" && <p style={{ fontSize: 12, color: "var(--text-light)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>AI generated</p>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 18, color: liked ? "var(--sage-dark)" : "var(--border)", lineHeight: 1 }}>
                          {liked ? "+" : "+"}
                        </span>
                        <span style={{ fontSize: 12, color: liked ? "var(--forest)" : "var(--text-muted)", fontWeight: liked ? 600 : 400 }}>
                          {q.votes ?? 0}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DISCUSSING ────────────────────────────────────────────────────────────
  if (phase === "discussing") {
    return (
      <div className="page">
        <MemberTopBar />
        <div className="page-content-narrow">
          <div style={{ marginBottom: 32 }}>
            <p className="label" style={{ marginBottom: 6 }}>Discussion</p>
            <h1 style={{ fontSize: 26, color: "var(--forest)" }}>{club.name}</h1>
          </div>

          {discussionQuestions.length === 0 ? (
            <div className="card-muted" style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Waiting for discussion to begin...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {discussionQuestions.map((q, i) => (
                <div key={q.id} className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13, color: "var(--text-light)", fontWeight: 600, paddingTop: 2, minWidth: 16 }}>{i + 1}</span>
                  <p style={{ fontSize: 15, lineHeight: 1.55 }}>{q.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FINISHED ──────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar-brand">Bookmarker</span>
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />
        <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{club.name}</span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, textAlign: "center" }}>
        <p className="label" style={{ marginBottom: 4 }}>Meeting complete</p>
        <h1 style={{ fontSize: 32, color: "var(--forest)" }}>{club.name}</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>See you next time.</p>
        <button onClick={() => { window.location.href = `/club/${club.memberLink}`; }} className="btn-primary" style={{ padding: "12px 32px" }}>
          Back to home
        </button>
      </div>
    </div>
  );
}