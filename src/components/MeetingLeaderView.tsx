"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Meeting = {
  id: string;
  status: string;
  meetingDate: Date;
};

type Book = {
  id: string;
  title: string;
  author: string | null;
};

type Chapter = {
  id: string;
  title: string;
  order: number;
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
  meeting: Meeting;
  book: Book;
  assignedChapters: Chapter[];
  initialQuestions: Question[];
  clubMemberLink: string;
  appUrl: string;
};

const VOTE_TIMER_SECONDS = 5 * 60;
const DISCUSSION_TIMER_SECONDS = 10 * 60;

export default function MeetingLeaderView({
  meeting,
  book,
  assignedChapters,
  initialQuestions,
  clubMemberLink,
  appUrl,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(meeting.status);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(VOTE_TIMER_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const discussionQuestions = questions
    .filter((q) => q.isSelected)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currentQuestion = discussionQuestions[currentQuestionIndex];

  // Poll for updated votes during voting phase
  useEffect(() => {
    if (status !== "voting") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/questions?meetingId=${meeting.id}`);
      const data = await res.json();
      if (data.questions) {
        setQuestions(
          data.questions.sort(
            (a: Question, b: Question) => (b.votes ?? 0) - (a.votes ?? 0)
          )
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status, meeting.id]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning) return;
    if (timeLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function updateStatus(
    newStatus: string,
    questionIds?: string[],
    questionIndex?: number
  ) {
    const res = await fetch("/api/meetings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: meeting.id,
        status: newStatus,
        selectedQuestionIds: questionIds,
        currentQuestionIndex: questionIndex,
      }),
    });
    const data = await res.json();
    if (res.ok && data.meeting?.status) {
      setStatus(data.meeting.status);
    }
  }

  async function generateQuestions() {
    setGeneratingQuestions(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      const data = await res.json();
      if (res.ok) setQuestions(data.questions);
    } finally {
      setGeneratingQuestions(false);
    }
  }

  async function startVoting() {
    await generateQuestions();
    await updateStatus("voting");
    setTimeLeft(VOTE_TIMER_SECONDS);
    setTimerRunning(true);
  }

  function toggleSelectQuestion(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 5
        ? [...prev, id]
        : prev
    );
  }

  async function startDiscussion() {
    const toSelect =
      selectedIds.length > 0
        ? selectedIds
        : questions.slice(0, 3).map((q) => q.id);

    // Update status in DB
    await updateStatus("discussing", toSelect, 0);

    // Fetch updated questions with isSelected set
    const res = await fetch(`/api/questions?meetingId=${meeting.id}`);
    const data = await res.json();
    if (data.questions) {
      setQuestions(data.questions);
    }

    setCurrentQuestionIndex(0);
    setTimeLeft(DISCUSSION_TIMER_SECONDS);
    setTimerRunning(true);
  }

  async function nextQuestion() {
    setAiInsight(null);
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setTimeLeft(DISCUSSION_TIMER_SECONDS);
    setTimerRunning(true);

    await fetch("/api/meetings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: meeting.id,
        status: "discussing",
        currentQuestionIndex: nextIndex,
      }),
    });
  }

  async function fetchInsight() {
    if (!currentQuestion) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          question: currentQuestion.text,
        }),
      });
      const data = await res.json();
      if (res.ok) setAiInsight(data.insight);
    } finally {
      setInsightLoading(false);
    }
  }

  async function endMeeting() {
    await updateStatus("finished");
    router.push("/dashboard");
    router.refresh();
  }

  const memberLinkUrl = `${appUrl}/club/${clubMemberLink}`;

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{book.title}</h1>
          <p className="text-sm text-gray-500">
            {assignedChapters.map((c) => c.title).join(", ")}
          </p>
        </div>
        <span className="text-sm px-3 py-1 bg-gray-100 rounded-full capitalize">
          {status}
        </span>
      </div>

      {/* UPCOMING */}
      {status === "upcoming" && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Member link</p>
            <p className="font-mono text-sm text-gray-600 break-all">
              {memberLinkUrl}
            </p>
          </div>
          <button
            onClick={startVoting}
            disabled={generatingQuestions}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            {generatingQuestions ? "Generating questions..." : "Start meeting"}
          </button>
        </div>
      )}

      {/* VOTING */}
      {status === "voting" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="font-medium">Voting phase</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
              <button
                onClick={() => setTimerRunning((r) => !r)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {timerRunning ? "Pause" : "Resume"}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Members are voting. Select questions for discussion, or skip to use
            the top voted.
          </p>

          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                onClick={() => toggleSelectQuestion(q.id)}
                className={`border rounded-lg px-4 py-3 cursor-pointer transition ${
                  selectedIds.includes(q.id)
                    ? "border-black bg-gray-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm">{q.text}</p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {q.source === "member" ? "👤" : "✨"} {q.votes ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startDiscussion}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition"
          >
            {selectedIds.length > 0
              ? `Start discussion with ${selectedIds.length} questions`
              : "Start discussion with top 3"}
          </button>
        </div>
      )}

      {/* DISCUSSING */}
      {status === "discussing" && (
        <div className="space-y-4">
          {currentQuestionIndex < discussionQuestions.length ? (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of{" "}
                  {discussionQuestions.length}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg">
                    {formatTime(timeLeft)}
                  </span>
                  <button
                    onClick={() => setTimerRunning((r) => !r)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {timerRunning ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-lg">{currentQuestion?.text}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={fetchInsight}
                  disabled={insightLoading}
                  className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {insightLoading ? "Thinking..." : "AI insight"}
                </button>
                <button
                  onClick={nextQuestion}
                  className="flex-1 bg-black text-white py-2 rounded-lg text-sm hover:bg-gray-800"
                >
                  {currentQuestionIndex < discussionQuestions.length - 1
                    ? "Next question"
                    : "Finish questions"}
                </button>
              </div>

              {aiInsight && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                  {aiInsight}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-lg font-medium">All questions discussed!</p>
              <button
                onClick={endMeeting}
                className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition"
              >
                End meeting
              </button>
            </div>
          )}
        </div>
      )}

      {status === "finished" && (
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Meeting finished</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      )}
    </div>
  );
}