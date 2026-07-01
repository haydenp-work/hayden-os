import { NextResponse } from "next/server";
import { runCommand } from "@/lib/command";

export const runtime = "nodejs";

export async function POST(req) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || !text.trim()) return NextResponse.json({ reply: "Type something first." });
  try {
    const r = await runCommand(text.trim());
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ reply: "Something went wrong running that.", error: String(e.message || e) }, { status: 500 });
  }
}
