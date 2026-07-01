import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { todayET, monthET, weekdayET, mondayISO_ET, addDaysISO } from "@/lib/tz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const today = todayET();
  const month = monthET();
  const mondayIso = mondayISO_ET();
  const sundayIso = addDaysISO(mondayIso, 6);
  const wday = weekdayET();

  // Materialize recurring reminders due today. Once per day, no duplicates, deletions respected.
  // We track what has already been placed today in app_settings (no schema change needed).
  let recurring = [];
  try {
    const { data: rules } = await supabase.from("recurring_tasks").select("*").order("created_at");
    recurring = rules || [];
  } catch (e) { recurring = []; }
  try {
    const ledgerKey = `recur_placed:${today}`;
    let placed = [];
    try {
      const { data: led } = await supabase.from("app_settings").select("value").eq("key", ledgerKey).single();
      if (led && led.value) placed = JSON.parse(led.value);
    } catch (e) { placed = []; }
    if (!Array.isArray(placed)) placed = [];

    const dueToday = recurring.filter((r) => r.weekday === wday);
    const { data: todayRows } = await supabase.from("daily_tasks").select("id, title").eq("day", today);
    const rows = todayRows || [];
    let changed = false;

    for (const r of dueToday) {
      const copies = rows.filter((t) => t.title === r.title);
      // Heal duplicates left over from the older bug: keep one, remove the rest.
      if (copies.length > 1) {
        for (const extra of copies.slice(1)) await supabase.from("daily_tasks").delete().eq("id", extra.id);
      }
      if (!placed.includes(r.id)) {
        if (copies.length === 0) { await supabase.from("daily_tasks").insert({ title: r.title, day: today }); rows.push({ id: "x", title: r.title }); }
        placed.push(r.id);
        changed = true;
      }
    }
    if (changed) await supabase.from("app_settings").upsert({ key: ledgerKey, value: JSON.stringify(placed) });
  } catch (e) { /* best effort, never block the dashboard */ }

  const [profile, events, wtasks, dtasks, goals, meals, journal, settings, spend] = await Promise.all([
    supabase.from("profile").select("*").eq("id", 1).single(),
    supabase.from("events").select("*").gte("day", mondayIso).lte("day", sundayIso).order("start_min"),
    supabase.from("weekly_tasks").select("*").order("created_at"),
    supabase.from("daily_tasks").select("*").gte("day", mondayIso).lte("day", sundayIso).order("created_at"),
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
    week: mondayIso,
    todayIso: today,
    events: (events.data || []).map((e) => ({ id: e.id, day: e.day, startMin: e.start_min, endMin: e.end_min, title: e.title })),
    weeklyTasks: (wtasks.data || []).map((t) => ({ id: t.id, title: t.title, done: t.done, pinned: t.pinned })),
    dailyTasks: (dtasks.data || []).map((t) => ({ id: t.id, title: t.title, done: t.done, day: t.day })),
    goals: (goals.data || []).map((g) => ({ id: g.id, text: g.body, scope: g.scope, done: g.done })),
    meals: mealsToday.map((m) => ({
      id: m.id, name: m.name, calories: m.calories, protein: m.protein,
      time: new Date(m.eaten_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })),
    nutrition: { calories, protein, proteinGoal: Number(settingsMap.protein_goal) || 200 },
    journal: (journal.data || []).map((j) => ({ id: j.id, date: j.day, text: j.body, summary: j.summary })),
    recurring: recurring.map((r) => ({ id: r.id, title: r.title, weekday: r.weekday })),
    spend: {
      limit: Number(settingsMap.spend_limit) || 4928,
      spent: curMonth ? Number(curMonth.spent) : 0,
      month,
      history: spendRows.map((r) => ({ month: r.month, spent: Number(r.spent) })),
    },
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
