import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaude } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST() {
  const [tasks, goals] = await Promise.all([
    supabase.from("tasks").select("title, category, priority").eq("status", "active"),
    supabase.from("goals").select("body, scope").eq("done", false),
  ]);

  const ctx = [
    "Active tasks:",
    ...(tasks.data || []).map((t) => `- [${t.priority}] (${t.category}) ${t.title}`),
    "",
    "Goals:",
    ...(goals.data || []).map((g) => `- (${g.scope}) ${g.body}`),
  ].join("\n");

  try {
    const out = await askClaude(
      `You are the owner's chief of staff. Below is their current board. ` +
        `Identify the top 3 things that will move the needle most right now. ` +
        `For each, give one short action-oriented line. Be specific and direct. No preamble.\n\n${ctx}`,
      { maxTokens: 500 }
    );
    return NextResponse.json({ advice: out.trim() });
  } catch (e) {
    return NextResponse.json({ advice: "", error: String(e.message || e) }, { status: 500 });
  }
}
