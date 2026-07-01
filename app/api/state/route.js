import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mondayOf(d) {
  const x = new Date(d);
  const off = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - off);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d) => d.toISOString().slice(0, 10);

export async function GET() {
  const now = new Date();
  const today = iso(now);
  const month = today.slice(0, 7);
  const monday = mondayOf(now);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

  const [profile, events, wtasks, dtasks, goals, meals, journal, settings, spend] = await Promise.all([
    supabase.from("profile").select("*").eq("id", 1).single(),
    supabase.from("events").select("*").gte("day", iso(monday)).lte("day", iso(sunday)).order("start_min"),
    supabase.from("weekly_tasks").select("*").order("created_at"),
    supabase.from("daily_tasks").select("*").eq("day", today).order("created_at"),
    supabase.from("goals").select("*").order("created_at", { ascending: false }),
    supabase.from("meals").select("*").eq("day", today).order("eaten_at", { ascending: false }),
    supabase.from("journal").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("app_settings").select("*"),
    supabase.from("monthly_spend").select("*").order("month"),
  ]);

  const settingsMap = {};
  for (const s of settings.data || []) settingsMap[s.key] = s.value;
  const spendRows = spend.data || [];
  const curMonth = spendRows.find((r) => r.month === month);
  const mealsToday = meals.data || [];
  const calories = mealsToday.reduce((a, b) => a + (b.calories || 0), 0);
  const protein = mealsToday.reduce((a, b) => a + (b.protein || 0), 0);

  return NextResponse.json({
    profile: profile.data || { name: "Hayden", role: "", org: "" },
    week: iso(monday),
    events: (events.data || []).map((e) => ({ id: e.id, day: e.day, startMin: e.start_min, endMin: e.end_min, title: e.title })),
    weeklyTasks: (wtasks.data || []).map((t) => ({ id: t.id, title: t.title, done: t.done, pinned: t.pinned })),
    dailyTasks: (dtasks.data || []).map((t) => ({ id: t.id, title: t.title, done: t.done })),
    goals: (goals.data || []).map((g) => ({ id: g.id, text: g.body, scope: g.scope, done: g.done })),
    meals: mealsToday.map((m) => ({
      id: m.id, name: m.name, calories: m.calories, protein: m.protein,
      time: new Date(m.eaten_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })),
    nutrition: { calories, protein, proteinGoal: Number(settingsMap.protein_goal) || 200 },
    journal: (journal.data || []).map((j) => ({ id: j.id, date: j.day, text: j.body, summary: j.summary })),
    spend: {
      limit: Number(settingsMap.spend_limit) || 4928,
      spent: curMonth ? Number(curMonth.spent) : 0,
      month,
      history: spendRows.map((r) => ({ month: r.month, spent: Number(r.spent) })),
    },
  });
}
