import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaudeImage, parseJson } from "@/lib/claude";

export const runtime = "nodejs";

const thisMonth = () => new Date().toISOString().slice(0, 7);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function POST(req) {
  const { type, image, mediaType } = await req.json().catch(() => ({}));
  if (!image) return NextResponse.json({ error: "no image" }, { status: 400 });
  const mt = mediaType || "image/png";

  try {
    if (type === "spend") {
      const out = await askClaudeImage(
        "This is a screenshot of a bank or credit card statement. Add up the total money SPENT " +
          "(purchases, debit card transactions, payments to merchants). Ignore incoming payments, " +
          "refunds, credits, deposits, transfers in, and running balances. " +
          "Return ONLY JSON, no prose: {\"total\": number} in US dollars, no currency symbol.",
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
        "This is a screenshot of a weekly schedule or calendar. Extract each scheduled item as one short " +
          "line combining the day and/or time with a brief description. " +
          "Return ONLY JSON, no prose: {\"items\": [\"Mon 9am Duke call\", \"Tue 2pm gym\"]}. " +
          "Keep each item under 8 words. If nothing is found, return {\"items\": []}.",
        image, mt, { maxTokens: 800 }
      );
      const j = parseJson(out);
      const items = Array.isArray(j.items)
        ? j.items.filter((x) => typeof x === "string" && x.trim()).slice(0, 40)
        : [];
      let inserted = [];
      if (items.length) {
        const rows = items.map((b, i) => ({ body: b.trim(), position: i }));
        const { data } = await supabase.from("schedule").insert(rows).select();
        inserted = (data || []).map((r) => ({ id: r.id, body: r.body }));
      }
      return NextResponse.json({ items: inserted });
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
