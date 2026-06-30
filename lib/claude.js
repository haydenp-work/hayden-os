// The reasoning layer. Everything that needs judgment runs through Claude:
// triage, calorie estimation, journal summaries, strategic priorities.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export async function askClaude(prompt, { maxTokens = 700, system } = {}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Pull a JSON object out of a model response even if it is wrapped in prose.
export function parseJson(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON object found");
  return JSON.parse(clean.slice(a, b + 1));
}

// Classify a raw capture into a structured task.
export async function classifyCapture(text, categories) {
  const out = await askClaude(
    `You triage captures for a personal operating system. The owner is a medical device sales rep who also runs a side project. ` +
      `Classify this note into a single task. Categories: ${categories.join(", ")}. ` +
      `Return ONLY JSON, no prose: {"title": short imperative task title, "category": one of the categories, "priority": "high"|"medium"|"low"}. ` +
      `Note: ${text}`,
    { maxTokens: 200 }
  );
  const j = parseJson(out);
  return {
    title: j.title || text,
    category: categories.includes(j.category) ? j.category : "Life Admin",
    priority: ["high", "medium", "low"].includes(j.priority) ? j.priority : "medium",
  };
}
