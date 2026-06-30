import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaude, parseJson } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  let m = { name: text.trim(), calories: 0, protein: 0 };
  try {
    const out = await askClaude(
      `Estimate nutrition for this meal. Return ONLY JSON, no prose: ` +
        `{"name": cleaned short meal name, "calories": integer kcal, "protein": integer grams}. Meal: ${text.trim()}`,
      { maxTokens: 200 }
    );
    const j = parseJson(out);
    m = { name: j.name || text.trim(), calories: Number(j.calories) || 0, protein: Number(j.protein) || 0 };
  } catch (e) {
    // keep zeros, still log the meal
  }

  const { data, error } = await supabase.from("meals").insert(m).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    meal: {
      id: data.id, name: data.name, calories: data.calories, protein: data.protein,
      time: new Date(data.eaten_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: data.day,
    },
  });
}
