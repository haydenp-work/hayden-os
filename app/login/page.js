"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) window.location.href = "/";
    else { setErr(true); setBusy(false); }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.brand}>
          <span style={s.mark} /> <span style={s.name}>HaydenOS</span>
        </div>
        <div style={s.label}>Enter password</div>
        <input
          type="password"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ ...s.input, borderColor: err ? "#e23a52" : "#1d2433" }}
          placeholder="Password"
        />
        {err && <div style={s.err}>That password did not work.</div>}
        <button style={s.btn} onClick={submit} disabled={busy}>
          {busy ? "Unlocking" : "Unlock"}
        </button>
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0d14" },
  card: { width: 320, background: "#0f131d", border: "1px solid #1d2433", borderRadius: 14, padding: 28 },
  brand: { display: "flex", alignItems: "center", gap: 9, marginBottom: 22 },
  mark: { width: 13, height: 13, borderRadius: 4, background: "linear-gradient(135deg,#e23a52,#34c6d8)" },
  name: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "#e7ecf5" },
  label: { fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#5b6478", marginBottom: 9 },
  input: { width: "100%", background: "#161c29", border: "1px solid #1d2433", borderRadius: 9, padding: "11px 13px", color: "#e7ecf5", fontSize: 14, outline: "none" },
  err: { color: "#e23a52", fontSize: 12.5, marginTop: 9 },
  btn: { width: "100%", marginTop: 16, background: "#e23a52", color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Inter',sans-serif" },
};
