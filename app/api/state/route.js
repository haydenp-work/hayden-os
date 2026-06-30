import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  const day = today();

  const [profile, tasks, habits, subtasks, log, meals, journal, goals, notes, accounts, history] =
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
      supabase.from("finance_accounts").select("*").order("name"),
      supabase.from("finance_history").select("*").order("day"),
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
    finance: {
      accounts: (accounts.data || []).map((a) => ({ id: a.id, name: a.name, value: Number(a.value) })),
      history: (history.data || []).map((h) => ({ date: h.day, value: Number(h.value) })),
    },
  });
}
