// Speech to text for Telegram voice notes. Claude has no audio model, so this
// is the one piece that uses OpenAI Whisper. If you do not set OPENAI_API_KEY,
// the Telegram bot still works for typed messages and just skips voice.
export async function transcribe(audioBuffer, filename = "audio.ogg") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set, voice transcription disabled");
  }
  const fd = new FormData();
  fd.append("file", new Blob([audioBuffer]), filename);
  fd.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}`);
  const data = await res.json();
  return data.text || "";
}
