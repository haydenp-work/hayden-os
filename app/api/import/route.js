import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaudeImage, parseJson } from "@/lib/claude";

export const runtime = "nodejs";

const iso = (d) => d.toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const WD = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x; }
const hhmmToMin = (s) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export async function POST(req) {
  const { type, image, mediaType } = await req.json().catch(() => ({}));
  if (!image) return NextResponse.json({ error: "no image" }, { status: 400 });
  const mt = mediaType || "image/png";

  try {
    if (type === "spend") {
      const out = await askClaudeImage(
        "This is a screenshot of a bank or credit card statement. Add up the total money SPENT " +
          "(purchases, debit transactions, payments to merchants). Ignore incoming payments, refunds, credits, " +
          "deposits, transfers in, and running balances. Return ONLY JSON: {\"total\": number} in US dollars, no symbol.",
        image, mt, { maxTokens: 300 }
      );
      const j = parseJson(out);
      const add = round2(j.total);
      const month = thisMonth();
      const { data: cur } = await supabase.from("monthly_spend").select("spent").eq("month", month).single();
      const newTotal = round2((cur ? Number(cur.spent) : 0) + add);
      await supabase.from("monthly_spend").upsert({ month, spent: newTotal });
      return NextResponse.json({ added: add, newTotal });
    }

    if (type === "schedule") {
      const out = await askClaudeImage(
        "This is a screenshot of a weekly schedule or calendar. Extract each scheduled item. " +
          "Return ONLY JSON, no prose: {\"events\":[{\"title\":\"...\",\"weekday\":\"Monday\",\"start\":\"HH:MM\",\"end\":\"HH:MM\"}]} " +
          "using a 24 hour clock. If an item has no clear time, use start 09:00 and end 10:00. weekday must be a full day name.",
        image, mt, { maxTokens: 900 }
      );
      const j = parseJson(out);
      const monday = mondayOf(new Date());
      const rows = [];
      for (const e of (j.events || [])) {
        const wd = WD[String(e.weekday || "").toLowerCase()];
        if (wd == null || !e.title) continue;
        const d = new Date(monday); d.setDate(monday.getDate() + ((wd + 6) % 7));
        const s = hhmmToMin(e.start) ?? 540;
        const en = hhmmToMin(e.end) ?? s + 60;
        rows.push({ title: String(e.title).slice(0, 80), day: iso(d), start_min: s, end_min: en });
      }
      let inserted = [];
      if (rows.length) {
        const { data } = await supabase.from("events").insert(rows).select();
        inserted = (data || []).map((r) => ({ id: r.id, day: r.day, startMin: r.start_min, endMin: r.end_min, title: r.title }));
      }
      return NextResponse.json({ events: inserted });
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
