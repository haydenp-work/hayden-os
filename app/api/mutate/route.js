import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req) {
  const { action, payload = {} } = await req.json().catch(() => ({}));
  try {
    switch (action) {
      case "task.complete":
        await supabase.from("tasks").update({ status: "done", starred: false }).eq("id", payload.id);
        break;
      case "task.star":
        await supabase.from("tasks").update({ starred: payload.starred }).eq("id", payload.id);
        break;
      case "task.delete":
        await supabase.from("tasks").delete().eq("id", payload.id);
        break;

      case "habit.toggleSub": {
        if (payload.done) {
          await supabase
            .from("habit_log")
            .upsert({ subtask_id: payload.subtaskId, day: today(), done: true });
        } else {
          await supabase
            .from("habit_log")
            .delete()
            .eq("subtask_id", payload.subtaskId)
            .eq("day", today());
        }
        break;
      }

      case "goal.add": {
        const { data } = await supabase
          .from("goals")
          .insert({ body: payload.text, scope: payload.scope })
          .select()
          .single();
        return NextResponse.json({ id: data.id });
      }
      case "goal.toggle":
        await supabase.from("goals").update({ done: payload.done }).eq("id", payload.id);
        break;
      case "goal.delete":
        await supabase.from("goals").delete().eq("id", payload.id);
        break;

      case "note.add": {
        const { data } = await supabase
          .from("brain_notes")
          .insert({ category: payload.category, body: payload.text })
          .select()
          .single();
        return NextResponse.json({ id: data.id });
      }
      case "note.delete":
        await supabase.from("brain_notes").delete().eq("id", payload.id);
        break;

      case "spend.set": {
        const month = new Date().toISOString().slice(0, 7);
        await supabase
          .from("monthly_spend")
          .upsert({ month, spent: Number(payload.amount) || 0 });
        break;
      }
      case "spend.limit": {
        await supabase
          .from("app_settings")
          .upsert({ key: "spend_limit", value: String(Number(payload.amount) || 0) });
        break;
      }

      case "schedule.add": {
        const { data } = await supabase
          .from("schedule")
          .insert({ body: payload.body, position: Number(payload.position) || 0 })
          .select()
          .single();
        return NextResponse.json({ id: data.id });
      }
      case "schedule.delete":
        await supabase.from("schedule").delete().eq("id", payload.id);
        break;
      case "schedule.uploaded":
        await supabase
          .from("app_settings")
          .upsert({ key: "sched_uploaded_week", value: String(payload.week || "") });
        break;

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
