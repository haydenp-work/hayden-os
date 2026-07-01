import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export async function POST(req) {
  const { action, payload = {} } = await req.json().catch(() => ({}));
  try {
    switch (action) {
      // ---------- calendar events ----------
      case "event.add": {
        const { data } = await supabase.from("events").insert({
          day: payload.day,
          start_min: Number(payload.startMin) || 540,
          end_min: Number(payload.endMin) || (Number(payload.startMin) || 540) + 60,
          title: payload.title,
        }).select().single();
        return NextResponse.json({ id: data.id });
      }
      case "event.delete":
        await supabase.from("events").delete().eq("id", payload.id);
        break;

      // ---------- weekly tasks ----------
      case "wtask.add": {
        const { data } = await supabase.from("weekly_tasks").insert({ title: payload.title }).select().single();
        return NextResponse.json({ id: data.id });
      }
      case "wtask.toggle":
        await supabase.from("weekly_tasks").update({ done: payload.done }).eq("id", payload.id);
        break;
      case "wtask.pin":
        await supabase.from("weekly_tasks").update({ pinned: payload.pinned }).eq("id", payload.id);
        break;
      case "wtask.delete":
        await supabase.from("weekly_tasks").delete().eq("id", payload.id);
        break;

      // ---------- daily tasks ----------
      case "dtask.add": {
        const day = payload.day || new Date().toISOString().slice(0, 10);
        const { data } = await supabase.from("daily_tasks").insert({ title: payload.title, day }).select().single();
        return NextResponse.json({ id: data.id });
      }
      case "dtask.toggle":
        await supabase.from("daily_tasks").update({ done: payload.done }).eq("id", payload.id);
        break;
      case "dtask.delete":
        await supabase.from("daily_tasks").delete().eq("id", payload.id);
        break;

      // ---------- goals ----------
      case "goal.add": {
        const { data } = await supabase.from("goals").insert({ body: payload.text, scope: payload.scope || "month" }).select().single();
        return NextResponse.json({ id: data.id });
      }
      case "goal.toggle":
        await supabase.from("goals").update({ done: payload.done }).eq("id", payload.id);
        break;
      case "goal.delete":
        await supabase.from("goals").delete().eq("id", payload.id);
        break;

      // ---------- spend + nutrition settings ----------
      case "spend.set":
        await supabase.from("monthly_spend").upsert({ month: thisMonth(), spent: Number(payload.amount) || 0 });
        break;
      case "spend.limit":
        await supabase.from("app_settings").upsert({ key: "spend_limit", value: String(Number(payload.amount) || 0) });
        break;
      case "recurring.add": {
        const { data } = await supabase.from("recurring_tasks").insert({ title: payload.title, weekday: Number(payload.weekday) }).select().single();
        return NextResponse.json({ id: data.id });
      }
      case "recurring.delete":
        await supabase.from("recurring_tasks").delete().eq("id", payload.id);
        break;

      case "protein.goal":
        await supabase.from("app_settings").upsert({ key: "protein_goal", value: String(Number(payload.grams) || 200) });
        break;

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
