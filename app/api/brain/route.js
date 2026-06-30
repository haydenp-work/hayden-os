import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaude } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req) {
  const { category } = await req.json().catch(() => ({}));
  if (!category) return NextResponse.json({ error: "missing category" }, { status: 400 });

  const [tasks, notes] = await Promise.all([
    supabase.from("tasks").select("title").eq("status", "active").eq("category", category),
    supabase.from("brain_notes").select("body").eq("category", category),
  ]);

  const body =
    `Category: ${category}.\n` +
    `Open tasks:\n${(tasks.data || []).map((t) => "- " + t.title).join("\n") || "none"}\n\n` +
    `Notes:\n${(notes.data || []).map((n) => "- " + n.body).join("\n") || "none"}\n\n` +
    `In 2 to 3 sentences, give the current state of this area and flag anything that needs attention. Plain text, no preamble.`;

  try {
    const out = await askClaude(body, { maxTokens: 300 });
    return NextResponse.json({ summary: out.trim() });
  } catch (e) {
    return NextResponse.json({ summary: "", error: String(e.message || e) }, { status: 500 });
  }
}
