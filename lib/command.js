import { supabase } from "@/lib/supabase";
import { askClaude, parseJson } from "@/lib/claude";
import { todayET, weekdayET, addDaysISO } from "@/lib/tz";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmmToMin = (s) => {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]); const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
};

// Best-effort pull of a task title from casual "add ... today" phrasing.
function extractTodayTask(text) {
  let t = String(text || "").trim();
  let m = t.match(/(?:saying|that says|:)\s+(.+)$/i);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  m = t.match(/^add\s+(?:a\s+task\s+)?(.+?)\s+(?:to\s+)?today\b/i);
  if (m) return m[1].trim();
  t = t.replace(/^\s*(add|remind me to|create|put|log)\s+/i, "")
       .replace(/\bto\s+today\b|\btoday\b/ig, "")
       .replace(/^a\s+task\s*/i, "")
       .replace(/\s+/g, " ").trim();
  return t || null;
}

async function buildContext() {
  const today = todayET();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const dIso = addDaysISO(today, i);
    const wd = new Date(dIso + "T12:00:00Z").getUTCDay();
    days.push(`${WEEKDAYS[wd]} ${dIso}`);
  }
  const [wt, dt, gl, ev] = await Promise.all([
    supabase.from("weekly_tasks").select("title, done").order("created_at"),
    supabase.from("daily_tasks").select("title, done").eq("day", today).order("created_at"),
    supabase.from("goals").select("body, scope, done").order("created_at", { ascending: false }),
    supabase.from("events").select("title, day, start_min").gte("day", today).order("day").limit(20),
  ]);
  return {
    today,
    days,
    weeklyTasks: (wt.data || []).map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`),
    dailyTasks: (dt.data || []).map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`),
    goals: (gl.data || []).map((g) => `(${g.scope}) ${g.done ? "[x]" : "[ ]"} ${g.body}`),
    events: (ev.data || []).map((e) => `${e.day} ${String(Math.floor(e.start_min / 60)).padStart(2, "0")}:${String(e.start_min % 60).padStart(2, "0")} ${e.title}`),
  };
}

export async function runCommand(text) {
  const ctx = await buildContext();
  const prompt =
    `You are the control layer for Hayden's personal dashboard. Hayden is a medical device sales rep in Charlotte. ` +
    `He typed a message. Decide if it is a request for ADVICE, or a COMMAND to change his dashboard, or both. ` +
    `Return ONLY JSON, no prose, in this exact shape:\n` +
    `{"reply": "a short friendly sentence, no em dashes or en dashes", "actions": [ ... ]}\n\n` +
    `Allowed action objects (use only these):\n` +
    `{"type":"add_daily_task","title":"..."}\n` +
    `{"type":"add_weekly_task","title":"..."}\n` +
    `{"type":"add_goal","title":"...","scope":"month"}  (scope is "month" or "week")\n` +
    `{"type":"add_event","title":"...","day":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}  (24h clock)\n` +
    `{"type":"add_recurring","title":"...","weekday":"Thursday"}  (a reminder that repeats every week on that weekday, lands in Today automatically)\n` +
    `{"type":"log_meal","name":"chicken burrito bowl","calories":700,"protein":50}  (calories and protein are OPTIONAL, omit them if unknown and they will be estimated)\n` +
    `{"type":"add_protein","grams":30}  (quick protein only entry toward the daily goal)\n` +
    `{"type":"add_spend","amount":45.50}  (adds this amount to this month's spend)\n` +
    `{"type":"set_spend","amount":1200}  (sets this month's spend total)\n` +
    `{"type":"set_protein_goal","grams":220}\n` +
    `{"type":"reset_nutrition"}  (clears everything logged for today, use when he mis-entered a meal or protein)\n` +
    `{"type":"complete_daily","match":"substring of the task title"}\n` +
    `{"type":"complete_weekly","match":"substring of the task title"}\n` +
    `{"type":"pin_weekly","match":"substring of the task title"}  (pins a weekly task into Today)\n\n` +
    `Rules: If Hayden explicitly asks to add, create, put, schedule, log, or remind, you MUST include the matching action every time. ` +
    `Never skip an add because a similar item already exists, and never reply that it is already there. Just perform the action. ` +
    `Only return an empty actions list when he is purely asking for advice or information. ` +
    `Pull the task text out of natural phrasing. Examples: ` +
    `"add a task to today saying test" -> {"type":"add_daily_task","title":"test"}. ` +
    `"remind me to call the lab today" -> {"type":"add_daily_task","title":"Call the lab"}. ` +
    `"put prep the Duke deck on my weekly list" -> {"type":"add_weekly_task","title":"Prep the Duke deck"}. ` +
    `Resolve day words like "tomorrow" or "Thursday" using this list of upcoming dates: ${ctx.days.join(", ")}. ` +
    `Today is ${ctx.today}. If no end time is given for an event, make it one hour after start. Never use em dashes or en dashes anywhere.\n\n` +
    `His current dashboard:\n` +
    `Weekly tasks: ${ctx.weeklyTasks.join(" | ") || "none"}\n` +
    `Today's tasks: ${ctx.dailyTasks.join(" | ") || "none"}\n` +
    `Goals: ${ctx.goals.join(" | ") || "none"}\n` +
    `Upcoming events: ${ctx.events.join(" | ") || "none"}\n\n` +
    `His message: "${text}"`;

  let out;
  try {
    out = parseJson(await askClaude(prompt, { maxTokens: 900 }));
  } catch (e) {
    return { reply: "I could not parse that. Try rephrasing.", done: 0 };
  }

  const actions = Array.isArray(out.actions) ? out.actions : [];
  let done = 0;
  const didParts = [];
  const errors = [];
  const created = { daily: [], weekly: [], events: [], goals: [], recurring: [], meals: [] };
  const completed = { daily: [], weekly: [] };
  const pinned = [];
  let spendSet = null;
  let proteinGoalSet = null;
  let nutritionReset = false;
  const today = ctx.today;
  const monthKey = today.slice(0, 7);
  const wdIndex = (name) => WEEKDAYS.findIndex((w) => w.toLowerCase() === String(name || "").toLowerCase());

  async function run(query, okMsg, bucket) {
    try {
      const { data, error } = await query;
      if (error) { errors.push(error.message || String(error)); return false; }
      done++; if (okMsg) didParts.push(okMsg);
      const row = Array.isArray(data) ? data[0] : data;
      if (bucket && row) created[bucket].push(row);
      return true;
    } catch (e) { errors.push(String(e.message || e)); return false; }
  }

  for (const a of actions) {
    if (a.type === "add_daily_task" && a.title) {
      await run(supabase.from("daily_tasks").insert({ title: a.title, day: today }).select().single(), `Added to today: "${a.title}".`, "daily");
    } else if (a.type === "add_weekly_task" && a.title) {
      await run(supabase.from("weekly_tasks").insert({ title: a.title }).select().single(), `Added weekly task: "${a.title}".`, "weekly");
    } else if (a.type === "add_goal" && a.title) {
      const sc = a.scope === "week" ? "week" : "month";
      await run(supabase.from("goals").insert({ body: a.title, scope: sc }).select().single(), `Added ${sc} goal: "${a.title}".`, "goals");
    } else if (a.type === "add_event" && a.title && a.day) {
      const s = hhmmToMin(a.start) ?? 540; const e = hhmmToMin(a.end) ?? s + 60;
      await run(supabase.from("events").insert({ title: a.title, day: a.day, start_min: s, end_min: e }).select().single(), `Added event: ${a.title} on ${a.day} at ${a.start || "9:00"}.`, "events");
    } else if (a.type === "add_recurring" && a.title) {
      const wd = wdIndex(a.weekday);
      if (wd >= 0) {
        const { data: rule, error } = await supabase.from("recurring_tasks").insert({ title: a.title, weekday: wd }).select().single();
        if (error) errors.push(error.message);
        else {
          done++; didParts.push(`Repeating every ${WEEKDAYS[wd]}: "${a.title}".`); created.recurring.push(rule);
          if (wd === weekdayET()) {
            const { data: existing } = await supabase.from("daily_tasks").select("id").eq("day", today).eq("title", a.title);
            if (!existing || existing.length === 0) {
              const { data: dt } = await supabase.from("daily_tasks").insert({ title: a.title, day: today }).select().single();
              if (dt) created.daily.push(dt);
            }
            // record in today's ledger so state does not place a second copy
            try {
              const ledgerKey = `recur_placed:${today}`;
              let placed = [];
              const { data: led } = await supabase.from("app_settings").select("value").eq("key", ledgerKey).single();
              if (led && led.value) { try { placed = JSON.parse(led.value); } catch (e) { placed = []; } }
              if (!Array.isArray(placed)) placed = [];
              if (!placed.includes(rule.id)) { placed.push(rule.id); await supabase.from("app_settings").upsert({ key: ledgerKey, value: JSON.stringify(placed) }, { onConflict: "key" }); }
            } catch (e) { /* ledger is best effort */ }
          }
        }
      }
    } else if (a.type === "log_meal" && a.name) {
      let cals = Number(a.calories), prot = Number(a.protein);
      if (!Number.isFinite(cals) || !Number.isFinite(prot)) {
        try {
          const j = parseJson(await askClaude(`Estimate nutrition. Return ONLY JSON: {"calories": integer kcal, "protein": integer grams}. Meal: ${a.name}`, { maxTokens: 120 }));
          if (!Number.isFinite(cals)) cals = Number(j.calories) || 0;
          if (!Number.isFinite(prot)) prot = Number(j.protein) || 0;
        } catch (e) { cals = cals || 0; prot = prot || 0; }
      }
      await run(supabase.from("meals").insert({ name: a.name, calories: Math.round(cals) || 0, protein: Math.round(prot) || 0, day: today }).select().single(), `Logged: ${a.name} (${Math.round(prot) || 0}g protein).`, "meals");
    } else if (a.type === "add_protein" && a.grams) {
      const g = Math.round(Number(a.grams)) || 0;
      await run(supabase.from("meals").insert({ name: `${g}g protein`, calories: 0, protein: g, day: today }).select().single(), `Added ${g}g protein.`, "meals");
    } else if (a.type === "add_spend" && a.amount != null) {
      const { data: cur } = await supabase.from("monthly_spend").select("spent").eq("month", monthKey).single();
      const total = Math.round(((cur ? Number(cur.spent) : 0) + Number(a.amount)) * 100) / 100;
      if (await run(supabase.from("monthly_spend").upsert({ month: monthKey, spent: total }, { onConflict: "month" }), `Added $${Number(a.amount).toLocaleString()} to spend. Total $${total.toLocaleString()}.`)) spendSet = total;
    } else if (a.type === "set_spend" && a.amount != null) {
      const total = Math.round(Number(a.amount) * 100) / 100;
      if (await run(supabase.from("monthly_spend").upsert({ month: monthKey, spent: total }, { onConflict: "month" }), `Set spend to $${total.toLocaleString()}.`)) spendSet = total;
    } else if (a.type === "set_protein_goal" && a.grams) {
      const g = Math.round(Number(a.grams)) || 200;
      if (await run(supabase.from("app_settings").upsert({ key: "protein_goal", value: String(g) }, { onConflict: "key" }), `Protein goal set to ${g}g.`)) proteinGoalSet = g;
    } else if (a.type === "reset_nutrition") {
      if (await run(supabase.from("meals").delete().eq("day", today), "Cleared today's nutrition.")) nutritionReset = true;
    } else if (a.type === "complete_daily" && a.match) {
      const { data } = await supabase.from("daily_tasks").select("id, title").eq("day", today);
      const hit = (data || []).find((t) => t.title.toLowerCase().includes(String(a.match).toLowerCase()));
      if (hit && await run(supabase.from("daily_tasks").update({ done: true }).eq("id", hit.id), `Marked done: "${hit.title}".`)) completed.daily.push(hit.id);
    } else if (a.type === "complete_weekly" && a.match) {
      const { data } = await supabase.from("weekly_tasks").select("id, title");
      const hit = (data || []).find((t) => t.title.toLowerCase().includes(String(a.match).toLowerCase()));
      if (hit && await run(supabase.from("weekly_tasks").update({ done: true }).eq("id", hit.id), `Marked done: "${hit.title}".`)) completed.weekly.push(hit.id);
    } else if (a.type === "pin_weekly" && a.match) {
      const { data } = await supabase.from("weekly_tasks").select("id, title");
      const hit = (data || []).find((t) => t.title.toLowerCase().includes(String(a.match).toLowerCase()));
      if (hit && await run(supabase.from("weekly_tasks").update({ pinned: true }).eq("id", hit.id), `Pinned to today: "${hit.title}".`)) pinned.push(hit.id);
    }
  }

  // Safety net: he clearly asked to add to today but the model produced no add.
  const wantsTodayAdd = /^\s*(add|remind me to|create|put|log)\b/i.test(text) && /\btoday\b/i.test(text);
  const addedToday = didParts.some((p) => p.startsWith("Added to today"));
  if (wantsTodayAdd && !addedToday) {
    const title = extractTodayTask(text);
    if (title) {
      await run(supabase.from("daily_tasks").insert({ title, day: today }).select().single(), `Added to today: "${title}".`, "daily");
    }
  }

  if (errors.length && done === 0) {
    return { reply: `Save failed. Database said: ${errors[0]}`, done: 0, error: errors[0], created, completed, pinned, spendSet, proteinGoalSet, nutritionReset };
  }
  if (didParts.length) {
    return { reply: didParts.join(" ") + (errors.length ? ` (one part failed: ${errors[0]})` : ""), done, created, completed, pinned, spendSet, proteinGoalSet, nutritionReset };
  }
  return { reply: out.reply || "Okay.", done, created, completed, pinned, spendSet, proteinGoalSet, nutritionReset };
}
