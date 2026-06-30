import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { classifyCapture } from "@/lib/claude";
import { transcribe } from "@/lib/whisper";
import { CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";

const BOT = process.env.TELEGRAM_BOT_TOKEN;

async function tgReply(chatId, text) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function downloadVoice(fileId) {
  const meta = await fetch(`https://api.telegram.org/bot${BOT}/getFile?file_id=${fileId}`).then((r) => r.json());
  const path = meta?.result?.file_path;
  if (!path) throw new Error("no file path");
  const buf = await fetch(`https://api.telegram.org/file/bot${BOT}/${path}`).then((r) => r.arrayBuffer());
  return Buffer.from(buf);
}

export async function POST(req) {
  // Verify the secret you registered with setWebhook.
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => ({}));
  const msg = update.message || update.channel_post;
  if (!msg) return NextResponse.json({ ok: true });
  const chatId = msg.chat?.id;

  // Optional: lock the bot to your own chat id.
  if (process.env.TELEGRAM_ALLOWED_CHAT_ID && String(chatId) !== process.env.TELEGRAM_ALLOWED_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  let text = msg.text || msg.caption || "";
  try {
    if (msg.voice || msg.audio) {
      const fileId = (msg.voice || msg.audio).file_id;
      const buf = await downloadVoice(fileId);
      text = await transcribe(buf, "voice.ogg");
    }
  } catch (e) {
    await tgReply(chatId, "Could not transcribe that voice note. Try typing it.");
    return NextResponse.json({ ok: true });
  }

  if (!text.trim()) return NextResponse.json({ ok: true });

  let fields = { title: text.trim(), category: "Life Admin", priority: "medium" };
  try {
    fields = await classifyCapture(text.trim(), CATEGORIES);
  } catch (e) {
    /* fall back to unsorted */
  }

  await supabase.from("tasks").insert({ ...fields, source: "telegram" });
  await tgReply(chatId, `Filed: ${fields.title}\n${fields.category} · ${fields.priority} priority`);

  return NextResponse.json({ ok: true });
}
