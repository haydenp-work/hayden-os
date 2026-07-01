import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaude, parseJson } from "@/lib/claude";
import { todayET } from "@/lib/tz";

export const runtime = "nodejs";



export async function POST() {
  const today = todayET();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date());

  const [ev, wt, gl, dt, jr] = await Promise.all([
    supabase.from("events").select("title, start_min, end_min").eq("day", today).order("start_min"),
    supabase.from("weekly_tasks").select("title, done, pinned").eq("done", false),
    supabase.from("goals").select("body, scope, done").eq("done", false),
    supabase.from("daily_tasks").select("title").eq("day", today),
    supabase.from("journal").select("summary, body").order("created_at", { ascending: false }).limit(2),
  ]);

  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const events = (ev.data || []).map((e) => `${fmt(e.start_min)}-${fmt(e.end_min)} ${e.title}`);
  const weekly = (wt.data || []).map((t) => `${t.pinned ? "(pinned) " : ""}${t.title}`);
  const goals = (gl.data || []).map((g) => `(${g.scope}) ${g.body}`);
  const already = (dt.data || []).map((t) => t.title.toLowerCase());
  const reflections = (jr.data || []).map((j) => j.summary || j.body).filter(Boolean);

  const prompt =
    `You plan Hayden's day. He is a medical device sales rep who wants to protect his priorities and tends to drop personal and admin tasks. ` +
    `Today is ${weekday}. Recommend 3 to 6 concrete tasks he should do TODAY, drawn from his weekly tasks, his goals, and gaps around his calendar. ` +
    `Prefer pinned weekly tasks and anything tied to a goal. Keep each task short and actionable. Do not repeat tasks he already has today. ` +
    `Return ONLY JSON, no prose, no em dashes or en dashes: {"tasks":["...","..."]}\n\n` +
    `Calendar today: ${events.join(" | ") || "nothing scheduled"}\n` +
    `Open weekly tasks: ${weekly.join(" | ") || "none"}\n` +
    `Open goals: ${goals.join(" | ") || "none"}\n` +
    `Already on today's list: ${already.join(" | ") || "none"}\n` +
    `Recent reflections: ${reflections.join(" || ") || "none"}`;

  let tasks = [];
  try {
    const j = parseJson(await askClaude(prompt, { maxTokens: 500 }));
    tasks = Array.isArray(j.tasks) ? j.tasks.filter((t) => typeof t === "string" && t.trim()) : [];
  } catch (e) {
    return NextResponse.json({ error: "plan failed", added: [] }, { status: 500 });
  }

  tasks = tasks.filter((t) => !already.includes(t.trim().toLowerCase())).slice(0, 6);
  let added = [];
  if (tasks.length) {
    const rows = tasks.map((t) => ({ title: t.trim(), day: today }));
    const { data, error } = await supabase.from("daily_tasks").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message, added: [] }, { status: 500 });
    added = (data || []).map((r) => ({ id: r.id, title: r.title, done: r.done, day: r.day }));
  }
  return NextResponse.json({ added });
}
