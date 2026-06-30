import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { classifyCapture } from "@/lib/claude";
import { CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";

export async function POST(req) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  let fields = { title: text.trim(), category: "Life Admin", priority: "medium" };
  try {
    fields = await classifyCapture(text.trim(), CATEGORIES);
  } catch (e) {
    // Claude unavailable: fall back to an unsorted task rather than dropping it.
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, source: "web" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    task: { id: data.id, title: data.title, category: data.category, priority: data.priority, starred: data.starred, status: data.status },
  });
}
