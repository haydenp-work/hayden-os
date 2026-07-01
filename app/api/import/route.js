import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askClaudeImage, parseJson } from "@/lib/claude";
import { todayET, monthET, mondayISO_ET, addDaysISO } from "@/lib/tz";

export const runtime = "nodejs";

const thisMonth = () => monthET();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const WD = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x; }
const hhmmToMin = (s) => {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]); const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
};

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
        "This is a screenshot of a weekly GRID calendar (Outlook or Teams style). " +
          "The columns are days of the week, labeled in the header like Monday, Tuesday, Wednesday. " +
          "The rows are hours, labeled down the LEFT edge like 8 AM, 9 AM, 12 PM, 2 PM, 3 PM. " +
          "Each event is a colored block. Work out each event's START and END time from its VERTICAL POSITION: " +
          "the TOP edge of the block lines up with its start time and the BOTTOM edge with its end time, read against the hour labels on the left. " +
          "A block that starts halfway between 2 PM and 3 PM starts at 2:30 PM. Convert every time to a 24 hour HH:MM. " +
          "Put each event in the day of the column it sits in. " +
          "For the title use the main first line of the block only, ignore lines that just say 'Microsoft Teams Meeting' and ignore the organizer's name. " +
          "SKIP any block whose title starts with 'Canceled'. SKIP all day banners across the top such as holidays. " +
          "Return ONLY JSON, no prose: {\"events\":[{\"title\":\"...\",\"weekday\":\"Wednesday\",\"start\":\"HH:MM\",\"end\":\"HH:MM\"}]}",
        image, mt, { maxTokens: 1500 }
      );
      const j = parseJson(out);
      const raw = (j.events || []).length;
      const mondayIso = mondayISO_ET();
      const rows = [];
      for (const e of (j.events || [])) {
        let wd = null;
        const k = String(e.weekday || "").toLowerCase().trim();
        if (k in WD) wd = WD[k];
        if (wd == null && e.date) { const m = String(e.date).match(/\d{4}-\d{2}-\d{2}/); if (m) wd = new Date(m[0] + "T12:00:00Z").getUTCDay(); }
        if (wd == null || !e.title) continue;
        const dayIso = addDaysISO(mondayIso, (wd + 6) % 7);
        const s = hhmmToMin(e.start) ?? 540;
        const en = hhmmToMin(e.end) ?? s + 60;
        rows.push({ title: String(e.title).slice(0, 80), day: dayIso, start_min: s, end_min: en });
      }
      let inserted = [];
      if (rows.length) {
        const { data, error } = await supabase.from("events").insert(rows).select();
        if (error) return NextResponse.json({ error: error.message, raw, placed: 0, events: [] }, { status: 500 });
        inserted = (data || []).map((r) => ({ id: r.id, day: r.day, startMin: r.start_min, endMin: r.end_min, title: r.title }));
      }
      return NextResponse.json({ events: inserted, raw, placed: rows.length });
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
