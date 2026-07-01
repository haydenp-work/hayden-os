import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

export async function GET() {
  const day = today();
  const month = thisMonth();

  const [profile, tasks, habits, subtasks, log, meals, journal, goals, notes, settings, spend, sched] =
    await Promise.all([
      supabase.from("profile").select("*").eq("id", 1).single(),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("habits").select("*").order("position"),
      supabase.from("habit_subtasks").select("*").order("position"),
      supabase.from("habit_log").select("subtask_id, done").eq("day", day),
      supabase.from("meals").select("*").eq("day", day).order("eaten_at", { ascending: false }),
      supabase.from("journal").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("brain_notes").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("*"),
      supabase.from("monthly_spend").select("*").order("month"),
      supabase.from("schedule").select("*").order("position").order("created_at"),
    ]);

  const doneSet = new Set((log.data || []).filter((r) => r.done).map((r) => r.subtask_id));
  const habitsOut = (habits.data || []).map((h) => ({
    id: h.id,
    name: h.name,
    subtasks: (subtasks.data || [])
      .filter((s) => s.habit_id === h.id)
      .map((s) => ({ id: s.id, name: s.name, done: doneSet.has(s.id) })),
  }));

  const brainNotes = {};
  for (const n of notes.data || []) {
    (brainNotes[n.category] = brainNotes[n.category] || []).push({ id: n.id, text: n.body });
  }

  const settingsMap = {};
  for (const s of settings.data || []) settingsMap[s.key] = s.value;
  const spendRows = spend.data || [];
  const currentMonth = spendRows.find((r) => r.month === month);

  return NextResponse.json({
    profile: profile.data || { name: "Operator", role: "", org: "" },
    tasks: (tasks.data || []).map((t) => ({
      id: t.id, title: t.title, category: t.category, priority: t.priority,
      starred: t.starred, status: t.status,
    })),
    habits: habitsOut,
    meals: (meals.data || []).map((m) => ({
      id: m.id, name: m.name, calories: m.calories, protein: m.protein,
      time: new Date(m.eaten_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: m.day,
    })),
    journal: (journal.data || []).map((j) => ({ id: j.id, date: j.day, text: j.body, summary: j.summary })),
    goals: (goals.data || []).map((g) => ({ id: g.id, text: g.body, scope: g.scope, done: g.done })),
    brainNotes,
    spend: {
      limit: Number(settingsMap.spend_limit) || 4928,
      spent: currentMonth ? Number(currentMonth.spent) : 0,
      month,
      history: spendRows.map((r) => ({ month: r.month, spent: Number(r.spent) })),
    },
    schedule: {
      entries: (sched.data || []).map((s) => ({ id: s.id, body: s.body })),
      week: mondayOf(new Date()),
      uploadedWeek: settingsMap.sched_uploaded_week || "",
    },
  });
}

function mondayOf(d) {
  const x = new Date(d);
  const off = (x.getDay() + 6) % 7; // days since Monday
  x.setDate(x.getDate() - off);
  return x.toISOString().slice(0, 10);
}
