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

      case "account.add": {
        const { data } = await supabase
          .from("finance_accounts")
          .insert({ name: payload.name, value: Number(payload.value) || 0 })
          .select()
          .single();
        return NextResponse.json({ id: data.id });
      }
      case "account.delete":
        await supabase.from("finance_accounts").delete().eq("id", payload.id);
        break;

      case "finance.snapshot": {
        const { data: accts } = await supabase.from("finance_accounts").select("value");
        const net = (accts || []).reduce((a, b) => a + Number(b.value), 0);
        await supabase.from("finance_history").delete().eq("day", today());
        await supabase.from("finance_history").insert({ day: today(), value: net });
        break;
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
