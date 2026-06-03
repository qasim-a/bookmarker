"use client";

import { useState, useEffect } from "react";

type Club = {
  id: string;
  name: string;
  memberLink: string;
  memberPassword: string | null;
};

type Book = {
  id: string;
  title: string;
  author: string | null;
};

type Meeting = {
  id: string;
  meetingDate: Date;
  status: string;
};

type Chapter = {
  id: string;
  title: string;
  order: number;
};

type Member = {
  id: string;
  name: string;
};

type Attendance = {
  memberId: string;
  markedAttending: boolean | null;
  markedReading: boolean | null;
};

type Question = {
  id: string;
  text: string;
  source: string;
  votes: number | null;
  isSelected: boolean | null;
  order: number | null;
};

type Props = {
  club: Club;
  book: Book | null;
  meeting: Meeting | null;
  assignedChapters: Chapter[];
  members: Member[];
  attendance: Attendance[];
};

export default function MemberView({
  club,
  book,
  meeting,
  assignedChapters,
  members,
  attendance,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showNewMember, setShowNewMember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>(attendance);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [meetingStatus, setMeetingStatus] = useState(meeting?.status ?? "upcoming");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [localMembers, setLocalMembers] = useState<Member[]>(members);

  const myAttendance = localAttendance.find(
    (a) => a.memberId === selectedMemberId
  );

  const discussionQuestions = questions
    .filter((q) => q.isSelected)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Poll meeting status and questions when meeting is active
  useEffect(() => {
    if (!meeting) return;
    if (meetingStatus !== "voting" && meetingStatus !== "discussing") return;

    const interval = setInterval(async () => {
        const res = await fetch(
          `/api/questions?meetingId=${meeting.id}&memberId=${selectedMemberId ?? ""}`
        );
        const data = await res.json();
        if (data.questions) {
          setQuestions(data.questions);
        }
        if (data.voted) setVotedIds(data.voted);
      
        const statusRes = await fetch(
          `/api/meeting-status?meetingId=${meeting.id}&memberLink=${club.memberLink}`
        );
        const statusData = await statusRes.json();
      
        if (statusData.status) setMeetingStatus(statusData.status);
      
        if (statusData.status === "discussing") {
          const idx = statusData.currentQuestionIndex ?? 0;
          const selected = data.questions
            ? data.questions
                .filter((q: Question) => q.isSelected)
                .sort((a: Question, b: Question) => (a.order ?? 0) - (b.order ?? 0))
            : [];
          setCurrentQuestion(selected[idx] ?? null);
        }
      }, 5000);

    return () => clearInterval(interval);
  }, [meeting, meetingStatus, selectedMemberId, currentQuestion, questions, club.memberLink]);

  // Initial fetch when member selects themselves and meeting is active
  useEffect(() => {
    if (!meeting || !selectedMemberId) return;
    if (meetingStatus !== "voting" && meetingStatus !== "discussing") return;

    fetch(`/api/questions?meetingId=${meeting.id}&memberId=${selectedMemberId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.questions) {
          setQuestions(data.questions);
          setVotedIds(data.voted ?? []);
          const selected = data.questions
            .filter((q: Question) => q.isSelected)
            .sort((a: Question, b: Question) => (a.order ?? 0) - (b.order ?? 0));
          if (selected.length > 0) setCurrentQuestion(selected[0]);
        }
      });
  }, [meeting, selectedMemberId, meetingStatus]);

  // Immediately sync status when member selects themselves
useEffect(() => {
    if (!meeting || !selectedMemberId) return;
  
    async function syncStatus() {
      const res = await fetch(
        `/api/meeting-status?meetingId=${meeting!.id}&memberLink=${club.memberLink}`
      );
      const data = await res.json();
      if (data.status) setMeetingStatus(data.status);
  
      if (data.status === "voting" || data.status === "discussing") {
        const qRes = await fetch(
          `/api/questions?meetingId=${meeting!.id}&memberId=${selectedMemberId}`
        );
        const qData = await qRes.json();
        if (qData.questions) {
          setQuestions(qData.questions);
          setVotedIds(qData.voted ?? []);
          const selected = qData.questions
            .filter((q: Question) => q.isSelected)
            .sort((a: Question, b: Question) => (a.order ?? 0) - (b.order ?? 0));
          if (selected.length > 0) setCurrentQuestion(selected[0]);
        }
      }
    }
  
    syncStatus();
  }, [selectedMemberId, meeting, club.memberLink]);

  async function handleNewMember() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), memberLink: club.memberLink }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedMemberId(data.member.id);
      setLocalMembers((prev) => [...prev, data.member]);
      setShowNewMember(false);
      setNewName("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateAttendance(
    field: "markedAttending" | "markedReading",
    value: boolean
  ) {
    if (!selectedMemberId || !meeting) return;

    const current = myAttendance ?? {
      memberId: selectedMemberId,
      markedAttending: false,
      markedReading: false,
    };
    const updated = { ...current, [field]: value };

    setLocalAttendance((prev) => {
      const exists = prev.find((a) => a.memberId === selectedMemberId);
      if (exists)
        return prev.map((a) =>
          a.memberId === selectedMemberId ? updated : a
        );
      return [...prev, updated];
    });

    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: meeting.id,
        memberId: selectedMemberId,
        markedAttending: updated.markedAttending,
        markedReading: updated.markedReading,
      }),
    });
  }

  async function fetchSummary() {
    if (!meeting) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          memberLink: club.memberLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleVote(questionId: string) {
    if (!selectedMemberId) return;

    const alreadyVoted = votedIds.includes(questionId);
    setVotedIds((prev) =>
      alreadyVoted ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, votes: (q.votes ?? 0) + (alreadyVoted ? -1 : 1) }
          : q
      )
    );

    await fetch("/api/questions/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        memberId: selectedMemberId,
        memberLink: club.memberLink,
      }),
    });
  }

  async function submitQuestion() {
    if (!newQuestion.trim() || !selectedMemberId || !meeting) return;
    setSubmittingQuestion(true);
    try {
      const res = await fetch("/api/questions/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          memberId: selectedMemberId,
          memberLink: club.memberLink,
          text: newQuestion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions((prev) => [...prev, data.question]);
      setNewQuestion("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingQuestion(false);
    }
  }

  function selectNextQuestion(currentId: string) {
    const idx = discussionQuestions.findIndex((q) => q.id === currentId);
    const next = discussionQuestions[idx + 1];
    setCurrentQuestion(next ?? null);
  }

  const attendingCount = localAttendance.filter((a) => a.markedAttending).length;
  const readingDoneCount = localAttendance.filter((a) => a.markedReading).length;

  // Member selection screen — always shown first if not selected
  if (!selectedMemberId) {
    return (
      <div className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{club.name}</h1>
          {book && (
            <p className="text-gray-500 text-sm">
              {book.title} — {book.author}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <p className="font-medium">Who are you?</p>
          {localMembers.length > 0 && (
            <div className="space-y-1">
              {localMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className="w-full text-left border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {!showNewMember ? (
            <button
              onClick={() => setShowNewMember(true)}
              className="w-full border-dashed border-2 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
            >
              + I'm new
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border rounded-lg px-4 py-2 text-sm"
              />
              <button
                onClick={handleNewMember}
                disabled={loading}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Join
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const memberName = localMembers.find((m) => m.id === selectedMemberId)?.name;

  // VOTING PHASE
  if (meetingStatus === "voting") {
    return (
      <div className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{club.name}</h1>
          <button
            onClick={() => setSelectedMemberId(null)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            {memberName}
          </button>
        </div>

        <div className="space-y-1">
          <p className="font-medium">Vote for discussion questions</p>
          <p className="text-sm text-gray-500">Tap to upvote. Add your own below.</p>
        </div>

        <div className="space-y-2">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => handleVote(q.id)}
              className={`w-full text-left border rounded-lg px-4 py-3 transition ${
                votedIds.includes(q.id)
                  ? "border-black bg-gray-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm">{q.text}</p>
                <span className="text-xs text-gray-400 shrink-0">
                  {votedIds.includes(q.id) ? "▲" : "△"} {q.votes ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Add your own question</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="flex-1 border rounded-lg px-4 py-2 text-sm"
            />
            <button
              onClick={submitQuestion}
              disabled={submittingQuestion || !newQuestion.trim()}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DISCUSSING PHASE
  if (meetingStatus === "discussing") {
    return (
      <div className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{club.name}</h1>
          <button
            onClick={() => setSelectedMemberId(null)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            {memberName}
          </button>
        </div>

        {currentQuestion ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Now discussing</p>
            <div className="border rounded-lg p-4">
              <p className="text-lg">{currentQuestion.text}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Up next</p>
              {discussionQuestions
                .slice(
                  discussionQuestions.findIndex((q) => q.id === currentQuestion.id) + 1
                )
                .map((q) => (
                  <p key={q.id} className="text-sm text-gray-400 px-1">
                    — {q.text}
                  </p>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Waiting for discussion to start...</p>
        )}
      </div>
    );
  }

  // FINISHED
  if (meetingStatus === "finished") {
    return (
      <div className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{club.name}</h1>
        <p className="text-gray-500">The meeting has ended. See you next time!</p>
      </div>
    );
  }

  // UPCOMING — default view
  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{club.name}</h1>
        {book && (
          <p className="text-gray-500 text-sm">
            {book.title} — {book.author}
          </p>
        )}
      </div>

      {book && meeting && (
        <div className="border rounded-lg p-4 space-y-2">
          <p className="font-medium text-sm">Next meeting</p>
          <p className="text-lg">
            {new Date(meeting.meetingDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>

          {assignedChapters.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mt-2">Assigned reading</p>
              <ul className="mt-1 space-y-1">
                {assignedChapters.map((c) => (
                  <li key={c.id} className="text-sm">
                    {c.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>{attendingCount} attending</span>
            <span>{readingDoneCount} done reading</span>
          </div>

          <div className="mt-3 space-y-2">
            <button
              onClick={fetchSummary}
              disabled={summaryLoading}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {summaryLoading ? "Generating summary..." : "Get catch-up summary"}
            </button>
            {summary && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                {summary}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="font-medium">Hi, {memberName}</p>
        <button
          onClick={() => setSelectedMemberId(null)}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Not you?
        </button>
      </div>

      {meeting && (
        <div className="space-y-2">
          <label className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={myAttendance?.markedAttending ?? false}
              onChange={(e) =>
                updateAttendance("markedAttending", e.target.checked)
              }
              className="rounded"
            />
            <span className="text-sm">I'm attending the meeting</span>
          </label>
          <label className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={myAttendance?.markedReading ?? false}
              onChange={(e) =>
                updateAttendance("markedReading", e.target.checked)
              }
              className="rounded"
            />
            <span className="text-sm">I'm done with the assigned reading</span>
          </label>
        </div>
      )}
    </div>
  );
}