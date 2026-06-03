import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generate(prompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function summarizeChapters(
  bookTitle: string,
  author: string,
  chapters: { title: string; content: string }[]
): Promise<string> {
  const chapterText = chapters
    .map((c) => `${c.title}:\n${c.content}`)
    .join("\n\n");

  return generate(
    `You are a helpful book club assistant. Summarize the following chapters from "${bookTitle}" by ${author} in a clear, engaging way for a book club member who may have missed or forgotten the reading. Keep it under 300 words, focus on key plot points and character developments.

${chapterText}`
  );
}

export async function generateDiscussionQuestions(
  bookTitle: string,
  author: string,
  chapters: { title: string; content: string }[]
): Promise<string[]> {
  const chapterText = chapters
    .map((c) => `${c.title}:\n${c.content}`)
    .join("\n\n");

  const text = await generate(
    `You are a book club facilitator. Generate exactly 5 thought-provoking discussion questions for a book club meeting about the following chapters from "${bookTitle}" by ${author}.

The questions should be specific to the actual content, characters, and events in these chapters. Avoid generic questions that could apply to any book.

Return ONLY a JSON array of 5 strings, no other text, no markdown, no explanation. Example format:
["Question 1?", "Question 2?", ...]

Chapters:
${chapterText}`
  );

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function answerQuestion(
  bookTitle: string,
  author: string,
  question: string,
  chapters: { title: string; content: string }[]
): Promise<string> {
  const chapterText = chapters
    .map((c) => `${c.title}:\n${c.content}`)
    .join("\n\n");

  return generate(
    `You are a thoughtful book club facilitator discussing "${bookTitle}" by ${author}. A book club member has asked:

"${question}"

Provide an insightful answer that sparks further discussion. Reference specific events or characters from the text where relevant. Keep your response under 200 words and end with a follow-up question to keep the conversation going.

Chapters being discussed:
${chapterText}`
  );
}

export async function suggestNextBooks(
  currentBook: string,
  author: string,
  pastBooks: string[]
): Promise<string[]> {
  const pastList = pastBooks.length
    ? `The club has previously read: ${pastBooks.join(", ")}.`
    : "";

  const text = await generate(
    `You are a book club assistant. A book club just finished reading "${currentBook}" by ${author}. ${pastList}

Suggest exactly 5 books they might enjoy next. Consider similar themes, writing style, and genre. Avoid books they have already read.

Return ONLY a JSON array of 5 strings in the format "Title by Author", no other text, no markdown. Example:
["The Great Gatsby by F. Scott Fitzgerald", "To Kill a Mockingbird by Harper Lee"]`
  );

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}