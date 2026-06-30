import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaude } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  let summary = text.trim().slice(0, 90);
  try {
    const out = await askClaude(
      `Summarize this daily journal entry in one concise sentence capturing mood, a win, and any blocker. ` +
        `Return only the sentence. Entry: ${text.trim()}`,
      { maxTokens: 120 }
    );
    summary = out.trim().replace(/^["']|["']$/g, "");
  } catch (e) {
    // fall back to a truncated entry
  }

  const { data, error } = await supabase
    .from("journal")
    .insert({ body: text.trim(), summary })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entry: { id: data.id, date: data.day, text: data.body, summary: data.summary },
  });
}
