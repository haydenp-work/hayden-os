import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { todayET, monthET } from "@/lib/tz";

export const runtime = "nodejs";

// Throw on any Supabase error so the caller learns the truth instead of a false success.
const check = ({ data, error }) => { if (error) throw new Error(error.message || String(error)); return data; };
const ok = (extra) => NextResponse.json({ ok: true, ...(extra || {}) });

export async function POST(req) {
  const { action, payload = {} } = await req.json().catch(() => ({}));
  try {
    switch (action) {
      /* ---------- calendar events ---------- */
      case "event.add": {
        const s = Number(payload.startMin) || 540;
        const data = check(await supabase.from("events").insert({ day: payload.day, start_min: s, end_min: Number(payload.endMin) || s + 60, title: payload.title }).select().single());
        return ok({ id: data.id });
      }
      case "event.update":
        check(await supabase.from("events").update({ day: payload.day, start_min: Number(payload.startMin), end_min: Number(payload.endMin), title: payload.title }).eq("id", payload.id));
        return ok();
      case "event.delete":
        check(await supabase.from("events").delete().eq("id", payload.id));
        return ok();

      /* ---------- weekly tasks ---------- */
      case "wtask.add": {
        const data = check(await supabase.from("weekly_tasks").insert({ title: payload.title }).select().single());
        return ok({ id: data.id });
      }
      case "wtask.toggle":
        check(await supabase.from("weekly_tasks").update({ done: payload.done }).eq("id", payload.id));
        return ok();
      case "wtask.pin":
        check(await supabase.from("weekly_tasks").update({ pinned: payload.pinned }).eq("id", payload.id));
        return ok();
      case "wtask.delete":
        check(await supabase.from("weekly_tasks").delete().eq("id", payload.id));
        return ok();

      /* ---------- daily tasks ---------- */
      case "dtask.add": {
        const day = payload.day || todayET();
        const data = check(await supabase.from("daily_tasks").insert({ title: payload.title, day }).select().single());
        return ok({ id: data.id });
      }
      case "dtask.toggle":
        check(await supabase.from("daily_tasks").update({ done: payload.done }).eq("id", payload.id));
        return ok();
      case "dtask.delete":
        check(await supabase.from("daily_tasks").delete().eq("id", payload.id));
        return ok();

      /* ---------- goals ---------- */
      case "goal.add": {
        const data = check(await supabase.from("goals").insert({ body: payload.text, scope: payload.scope || "month" }).select().single());
        return ok({ id: data.id });
      }
      case "goal.toggle":
        check(await supabase.from("goals").update({ done: payload.done }).eq("id", payload.id));
        return ok();
      case "goal.delete":
        check(await supabase.from("goals").delete().eq("id", payload.id));
        return ok();

      /* ---------- recurring reminders ---------- */
      case "recurring.add": {
        const data = check(await supabase.from("recurring_tasks").insert({ title: payload.title, weekday: Number(payload.weekday) }).select().single());
        return ok({ id: data.id });
      }
      case "recurring.delete":
        check(await supabase.from("recurring_tasks").delete().eq("id", payload.id));
        return ok();

      /* ---------- spend ---------- */
      case "spend.set":
        check(await supabase.from("monthly_spend").upsert({ month: monthET(), spent: Number(payload.amount) || 0 }, { onConflict: "month" }));
        return ok();
      case "spend.limit":
        check(await supabase.from("app_settings").upsert({ key: "spend_limit", value: String(Number(payload.amount) || 0) }, { onConflict: "key" }));
        return ok();

      /* ---------- nutrition ---------- */
      case "protein.goal":
        check(await supabase.from("app_settings").upsert({ key: "protein_goal", value: String(Number(payload.grams) || 200) }, { onConflict: "key" }));
        return ok();
      case "meal.delete":
        check(await supabase.from("meals").delete().eq("id", payload.id));
        return ok();
      case "nutrition.reset":
        check(await supabase.from("meals").delete().eq("day", todayET()));
        return ok();

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
