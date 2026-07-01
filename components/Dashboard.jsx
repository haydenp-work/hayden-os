"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Home, ListTodo, Brain, Flame, Utensils, BookOpen, Target, Wallet,
  Mic, Plus, Star, Check, Sparkles, Eye, EyeOff, Trash2, Loader2,
  X, ChevronRight, TrendingUp, Zap, Camera,
} from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

/* ============================================================
   HaydenOS dashboard (production). Loads from /api/state and
   writes through the API routes. Voice on web uses the browser
   Web Speech API; phone voice comes in through the Telegram bot.
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 10);
const priColor = (p) => (p === "high" ? "var(--accent)" : p === "medium" ? "var(--gold)" : "var(--blue)");

async function mutate(action, payload) {
  try {
    const res = await fetch("/api/mutate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    return await res.json().catch(() => ({}));
  } catch (e) { return {}; }
}
async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const [meta, data] = String(r.result).split(",");
      const mediaType = (meta.match(/data:(.*?);/) || [])[1] || "image/png";
      resolve({ data, mediaType });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function startVoice(onText, onState) {
  const Rec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Rec) { onState && onState("unsupported"); return null; }
  const r = new Rec();
  r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e) => { onText(e.results[0][0].transcript); onState && onState("idle"); };
  r.onerror = () => onState && onState("idle");
  r.onend = () => onState && onState("idle");
  r.start(); onState && onState("listening");
  return r;
}

const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "crm", label: "Tasks", icon: ListTodo },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "habits", label: "Habits", icon: Flame },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "goals", label: "Goals", icon: Target },
  { id: "finance", label: "Finance", icon: Wallet },
];

export default function Dashboard() {
  const [os, setOs] = useState(null);
  const [view, setView] = useState("home");
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(new Date());

  // Every hook is declared here, before the loading return below, so the
  // number of hooks is identical on every render (React rules of hooks).
  const [capText, setCapText] = useState("");
  const [capLoading, setCapLoading] = useState(false);
  const [capVoice, setCapVoice] = useState("idle");
  const [advice, setAdvice] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [mealText, setMealText] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [jText, setJText] = useState("");
  const [jVoice, setJVoice] = useState("idle");
  const [jSaving, setJSaving] = useState(false);
  const [crmFilter, setCrmFilter] = useState("All");
  const [brainCat, setBrainCat] = useState(null);
  const [brainSummary, setBrainSummary] = useState("");
  const [brainLoading, setBrainLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [goalScope, setGoalScope] = useState("week");
  const [spentInput, setSpentInput] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [schedInput, setSchedInput] = useState("");
  const [impSpend, setImpSpend] = useState(false);
  const [impSched, setImpSched] = useState(false);
  const spendFileRef = useRef(null);
  const schedFileRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/state");
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      setOs(data);
    })();
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const patch = (fn) => setOs((p) => fn({ ...p }));

  if (!os) {
    return (<><Style /><div className="os boot"><Loader2 size={22} className="spin" /><span>Loading HaydenOS</span></div></>);
  }

  const activeTasks = os.tasks.filter((t) => t.status === "active");
  const keyTasks = activeTasks.filter((t) => t.starred);
  const habitPct = () => {
    const all = os.habits.flatMap((h) => h.subtasks);
    if (!all.length) return 0;
    return Math.round((all.filter((s) => s.done).length / all.length) * 100);
  };

  /* ---------- actions ---------- */
  function completeTask(id) {
    patch((p) => { p.tasks = p.tasks.map((t) => t.id === id ? { ...t, status: "done", starred: false } : t); return p; });
    mutate("task.complete", { id }); flash("Done. Sent to archive.");
  }
  function toggleStar(id) {
    const t = os.tasks.find((x) => x.id === id); const v = !t.starred;
    patch((p) => { p.tasks = p.tasks.map((x) => x.id === id ? { ...x, starred: v } : x); return p; });
    mutate("task.star", { id, starred: v });
  }
  function delTask(id) {
    patch((p) => { p.tasks = p.tasks.filter((t) => t.id !== id); return p; });
    mutate("task.delete", { id });
  }
  function toggleSub(hid, sid) {
    let v = false;
    patch((p) => {
      p.habits = p.habits.map((h) => h.id === hid ? { ...h, subtasks: h.subtasks.map((s) => { if (s.id === sid) { v = !s.done; return { ...s, done: v }; } return s; }) } : h);
      return p;
    });
    mutate("habit.toggleSub", { subtaskId: sid, done: v });
  }
  function toggleGoal(id) {
    const g = os.goals.find((x) => x.id === id); const v = !g.done;
    patch((p) => { p.goals = p.goals.map((x) => x.id === id ? { ...x, done: v } : x); return p; });
    mutate("goal.toggle", { id, done: v });
  }
  async function addGoal(text, scope) {
    if (!text.trim()) return;
    const r = await mutate("goal.add", { text: text.trim(), scope });
    patch((p) => { p.goals = [...p.goals, { id: r.id || uid(), text: text.trim(), scope, done: false }]; return p; });
  }
  function delGoal(id) {
    patch((p) => { p.goals = p.goals.filter((g) => g.id !== id); return p; });
    mutate("goal.delete", { id });
  }
  async function addNote(cat, text) {
    if (!text.trim()) return;
    const r = await mutate("note.add", { category: cat, text: text.trim() });
    patch((p) => { p.brainNotes = { ...p.brainNotes, [cat]: [{ id: r.id || uid(), text: text.trim() }, ...(p.brainNotes[cat] || [])] }; return p; });
  }
  function delNote(cat, id) {
    patch((p) => { p.brainNotes = { ...p.brainNotes, [cat]: (p.brainNotes[cat] || []).filter((n) => n.id !== id) }; return p; });
    mutate("note.delete", { id });
  }
  async function setSpend(amount) {
    const v = Number(amount) || 0;
    patch((p) => { p.spend = { ...p.spend, spent: v }; return p; });
    await mutate("spend.set", { amount: v });
    flash("Spend updated.");
  }
  async function setLimit(amount) {
    const v = Number(amount) || 0;
    patch((p) => { p.spend = { ...p.spend, limit: v }; return p; });
    await mutate("spend.limit", { amount: v });
    flash("Limit updated.");
  }
  async function addScheduleItem(body) {
    if (!body.trim()) return;
    const r = await mutate("schedule.add", { body: body.trim() });
    patch((p) => { p.schedule = { ...p.schedule, entries: [...p.schedule.entries, { id: r.id || uid(), body: body.trim() }] }; return p; });
  }
  function delScheduleItem(id) {
    patch((p) => { p.schedule = { ...p.schedule, entries: p.schedule.entries.filter((e) => e.id !== id) }; return p; });
    mutate("schedule.delete", { id });
  }
  function toggleUploaded() {
    const week = os.schedule.week;
    const done = os.schedule.uploadedWeek === week;
    const next = done ? "" : week;
    patch((p) => { p.schedule = { ...p.schedule, uploadedWeek: next }; return p; });
    mutate("schedule.uploaded", { week: next });
    flash(done ? "Reminder reset." : "Marked done for this week.");
  }
  async function importSpendShot(file) {
    if (!file) return;
    setImpSpend(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const r = await post("/api/import", { type: "spend", image: data, mediaType });
      if (r && typeof r.newTotal === "number") {
        patch((p) => { p.spend = { ...p.spend, spent: r.newTotal }; return p; });
        flash(`Added $${r.added.toLocaleString()} from statement. Month total $${r.newTotal.toLocaleString()}.`);
      } else flash("Could not read that statement. Try a clearer screenshot.");
    } catch (e) { flash("Import failed. Try again."); }
    setImpSpend(false);
    if (spendFileRef.current) spendFileRef.current.value = "";
  }
  async function importSchedShot(file) {
    if (!file) return;
    setImpSched(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const r = await post("/api/import", { type: "schedule", image: data, mediaType });
      if (r && Array.isArray(r.items) && r.items.length) {
        patch((p) => { p.schedule = { ...p.schedule, entries: [...p.schedule.entries, ...r.items] }; return p; });
        flash(`Added ${r.items.length} items from your schedule.`);
      } else flash("Could not read that schedule. Try a clearer screenshot.");
    } catch (e) { flash("Import failed. Try again."); }
    setImpSched(false);
    if (schedFileRef.current) schedFileRef.current.value = "";
  }

  /* ---------- capture ---------- */
  async function capture() {
    if (!capText.trim()) return;
    setCapLoading(true);
    const r = await post("/api/capture", { text: capText.trim() });
    if (r.task) { patch((p) => { p.tasks = [r.task, ...p.tasks]; return p; }); flash(`Filed under ${r.task.category}, ${r.task.priority} priority`); }
    else flash("Could not file that. Try again.");
    setCapText(""); setCapLoading(false);
  }

  /* ---------- strategic ---------- */
  async function getAdvice() {
    setAdviceLoading(true); setAdvice("");
    const r = await post("/api/advice", {});
    setAdvice(r.advice || "Claude is not reachable right now. Try again in a moment.");
    setAdviceLoading(false);
  }

  /* ---------- nutrition ---------- */
  async function logMeal() {
    if (!mealText.trim()) return;
    setMealLoading(true);
    const r = await post("/api/meal", { text: mealText.trim() });
    if (r.meal) patch((p) => { p.meals = [r.meal, ...p.meals]; return p; });
    setMealText(""); setMealLoading(false);
  }

  /* ---------- journal ---------- */
  async function saveJournal() {
    if (!jText.trim()) return;
    setJSaving(true);
    const r = await post("/api/journal", { text: jText.trim() });
    if (r.entry) patch((p) => { p.journal = [r.entry, ...p.journal]; return p; });
    setJText(""); setJSaving(false);
  }

  /* ===================== views ===================== */
  function renderHome() {
    const pct = habitPct();
    const spent = os.spend?.spent || 0;
    const limit = os.spend?.limit || 4928;
    const hour = now.getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const focus = os.goals.find((g) => g.scope === "month" && !g.done)?.text || "Set a monthly goal";
    const cals = os.meals.reduce((a, b) => a + b.calories, 0);
    const pro = os.meals.reduce((a, b) => a + b.protein, 0);
    const sow = new Date(now); sow.setDate(now.getDate() - now.getDay());
    const week = [...Array(7)].map((_, i) => { const d = new Date(sow); d.setDate(sow.getDate() + i); return d; });
    const dow = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const isFriday = now.getDay() === 5;
    const uploadedThisWeek = !!(os.schedule?.uploadedWeek && os.schedule.uploadedWeek === os.schedule.week);

    return (
      <div className="cols">
        {/* LEFT */}
        <div className="col">
          <div className="panel">
            <div className="plabel"><span className="num">00</span> OPERATOR <span className="live"><span className="dot" /> online</span></div>
            <div className="op-name">{os.profile.name}</div>
            <div className="op-sub">{os.profile.role}{os.profile.org ? ` · ${os.profile.org}` : ""}</div>
            <div className="op-meta">
              <div><div className="mk">Focus</div><div className="mv serif">{focus}</div></div>
              <div><div className="mk">Today</div><div className="mv mono">{pct}%</div></div>
            </div>
          </div>

          <SpendPanel spent={spent} limit={limit} history={os.spend?.history || []} />

          <div className="panel">
            <div className="plabel"><span className="num">04</span> KEY TASKS <span className="pcount">{keyTasks.length}</span></div>
            {keyTasks.length === 0 && <div className="empty">Star 3 to 5 tasks to set today's priorities.</div>}
            <div className="list">
              {keyTasks.map((t) => (
                <div key={t.id} className="row">
                  <button className="check" onClick={() => completeTask(t.id)}><Check size={13} /></button>
                  <span className="row-title">{t.title}</span>
                  <span className="dot-pri" style={{ background: priColor(t.priority) }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="col">
          <div className="panel session">
            <div className="plabel"><span className="num">01</span> SESSION <span className="pcount mono">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} LOCAL</span></div>
            <div className="greeting">{greet}, <span className="g-name">{os.profile.name}</span>.</div>
            <div className="sess-date">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
            <div className="cap">
              <input className="cap-inp" placeholder="Capture anything. Claude files it." value={capText} onChange={(e) => setCapText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") capture(); }} />
              <button className={capVoice === "listening" ? "cap-mic rec" : "cap-mic"} onClick={() => startVoice((t) => setCapText((p) => (p ? p + " " : "") + t), setCapVoice)}><Mic size={15} /></button>
              <button className="cap-go" onClick={capture} disabled={capLoading}>{capLoading ? <Loader2 size={14} className="spin" /> : "Capture"}</button>
            </div>
          </div>

          <div className="panel">
            <div className="plabel"><span className="num">02</span> HABITS <span className="pcount mono">{pct}%</span></div>
            <div className="habit-cards">
              {os.habits.map((h) => {
                const done = h.subtasks.filter((s) => s.done).length;
                const full = h.subtasks.length && done === h.subtasks.length;
                const w = h.subtasks.length ? (done / h.subtasks.length) * 100 : 0;
                return (
                  <button key={h.id} className={full ? "hcard full" : "hcard"} onClick={() => setView("habits")}>
                    <div className="hc-top"><span className="hc-name">{h.name}</span>{full ? <Check size={13} color="var(--accent)" /> : null}</div>
                    <div className="hc-bar"><span style={{ width: w + "%" }} /></div>
                    <div className="hc-frac mono">{done}/{h.subtasks.length}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="plabel"><span className="num">05</span> STRATEGIC READ
              <button className="ghost-btn sm" onClick={getAdvice} disabled={adviceLoading}>{adviceLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />} {adviceLoading ? "Thinking" : "Top 3"}</button>
            </div>
            {!advice && !adviceLoading && <div className="empty">Ask Claude what to prioritize across every task and goal.</div>}
            {advice && <div className="advice">{advice.split("\n").filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>}
          </div>

          <div className="panel">
            <div className="plabel"><span className="num">06</span> SCHEDULE <span className="pcount mono">{now.toLocaleDateString([], { month: "short", year: "numeric" }).toUpperCase()}</span></div>
            <div className="cal-strip">
              {week.map((d, i) => {
                const isToday = d.toDateString() === now.toDateString();
                return (
                  <div key={i} className={isToday ? "cal-day on" : "cal-day"}>
                    <div className="cal-dow">{dow[d.getDay()]}</div>
                    <div className="cal-num mono">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            <button className={uploadedThisWeek ? "reminder done" : (isFriday ? "reminder due" : "reminder")} onClick={toggleUploaded}>
              <span className="rem-box">{uploadedThisWeek && <Check size={12} />}</span>
              <span className="rem-text">Upload next week's schedule</span>
              <span className="rem-tag mono">{uploadedThisWeek ? "done" : isFriday ? "due today" : "every Fri"}</span>
            </button>

            <div className="cap" style={{ marginTop: 12 }}>
              <input className="cap-inp" placeholder="Add a schedule item, e.g. Mon 9am Duke call" value={schedInput} onChange={(e) => setSchedInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addScheduleItem(schedInput); setSchedInput(""); } }} />
              <button className="cap-go" onClick={() => { addScheduleItem(schedInput); setSchedInput(""); }}>Add</button>
              <input ref={schedFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => importSchedShot(e.target.files && e.target.files[0])} />
              <button className="cap-mic" title="Import from screenshot" onClick={() => schedFileRef.current && schedFileRef.current.click()} disabled={impSched}>{impSched ? <Loader2 size={15} className="spin" /> : <Camera size={15} />}</button>
            </div>

            <div className="list" style={{ marginTop: 8 }}>
              {os.schedule.entries.length === 0 && <div className="empty">No schedule items yet. Add your week above.</div>}
              {os.schedule.entries.map((e) => (
                <div key={e.id} className="row">
                  <span className="dot-pri" style={{ background: "var(--accent)" }} />
                  <span className="row-title">{e.body}</span>
                  <button className="icon-btn faint" onClick={() => delScheduleItem(e.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col">
          <div className="panel">
            <div className="plabel"><span className="num">03</span> GOALS</div>
            {["week", "month"].map((sc) => (
              <div key={sc} className="goal-block">
                <div className="goal-scope">This {sc}</div>
                {os.goals.filter((g) => g.scope === sc).length === 0 && <div className="empty">No {sc} goals yet.</div>}
                {os.goals.filter((g) => g.scope === sc).map((g) => (
                  <div key={g.id} className={g.done ? "goal done" : "goal"} onClick={() => toggleGoal(g.id)}>
                    <span className="goal-box">{g.done && <Check size={11} />}</span>{g.text}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="plabel"><span className="num">07</span> NUTRITION <span className="pcount mono">TODAY</span></div>
            <div className="nut-big mono">{cals}<span className="nut-unit">kcal</span></div>
            <div className="nut-sub mono">{pro}g protein · {os.meals.length} meals</div>
            <div className="cap" style={{ marginTop: 12 }}>
              <input className="cap-inp" placeholder="Log a meal, e.g. chicken and rice" value={mealText} onChange={(e) => setMealText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") logMeal(); }} />
              <button className="cap-go" onClick={logMeal} disabled={mealLoading}>{mealLoading ? <Loader2 size={14} className="spin" /> : "Log"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCrm() {
    const order = { high: 0, medium: 1, low: 2 };
    const shown = activeTasks
      .filter((t) => crmFilter === "All" || t.category === crmFilter)
      .sort((a, b) => (b.starred - a.starred) || order[a.priority] - order[b.priority]);
    const archived = os.tasks.filter((t) => t.status === "done").slice(0, 8);
    return (
      <div>
        <div className="chips">
          {["All", ...CATEGORIES].map((c) => (
            <button key={c} className={crmFilter === c ? "chip on" : "chip"} onClick={() => setCrmFilter(c)}>{c}</button>
          ))}
        </div>
        <div className="panel">
          {shown.length === 0 && <div className="empty">Nothing here. Capture something above.</div>}
          <div className="list">
            {shown.map((t) => (
              <div key={t.id} className="row task">
                <button className="check" onClick={() => completeTask(t.id)}><Check size={13} /></button>
                <button className={t.starred ? "star on" : "star"} onClick={() => toggleStar(t.id)}><Star size={13} /></button>
                <span className="row-title">{t.title}</span>
                <span className="tag">{t.category}</span>
                <span className="pill" style={{ color: priColor(t.priority), borderColor: priColor(t.priority) }}>{t.priority}</span>
                <button className="icon-btn faint" onClick={() => delTask(t.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
        {archived.length > 0 && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-head"><div className="panel-title">Recently completed</div></div>
            <div className="list">
              {archived.map((t) => (
                <div key={t.id} className="row done-row">
                  <span className="check on"><Check size={13} /></span>
                  <span className="row-title strike">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  async function summarizeCat(cat) {
    setBrainLoading(true); setBrainSummary("");
    const r = await post("/api/brain", { category: cat });
    setBrainSummary(r.summary || "Claude is not reachable right now.");
    setBrainLoading(false);
  }
  function renderBrain() {
    if (brainCat) {
      const tasks = activeTasks.filter((t) => t.category === brainCat);
      const notes = os.brainNotes[brainCat] || [];
      return (
        <div>
          <button className="back" onClick={() => { setBrainCat(null); setBrainSummary(""); }}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All areas</button>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title"><Brain size={14} /> {brainCat}</div>
              <button className="ghost-btn" onClick={() => summarizeCat(brainCat)} disabled={brainLoading}>
                {brainLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Summary
              </button>
            </div>
            {brainSummary && <div className="advice"><p>{brainSummary}</p></div>}
            <div className="sub-label">Open tasks</div>
            {tasks.length === 0 ? <div className="empty">No open tasks here.</div> : (
              <div className="list">{tasks.map((t) => <div key={t.id} className="row"><span className="dot-pri" style={{ background: priColor(t.priority) }} /><span className="row-title">{t.title}</span></div>)}</div>
            )}
            <div className="sub-label">Notes and links</div>
            <div className="note-add">
              <input className="inp" placeholder="Add a note or link" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addNote(brainCat, noteText); setNoteText(""); } }} />
              <button className="solid-btn" onClick={() => { addNote(brainCat, noteText); setNoteText(""); }}><Plus size={14} /></button>
            </div>
            <div className="list">
              {notes.map((n) => (
                <div key={n.id} className="row note">
                  <span className="row-title">{n.text}</span>
                  <button className="icon-btn faint" onClick={() => delNote(brainCat, n.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="brain-grid">
        {CATEGORIES.map((c) => {
          const count = activeTasks.filter((t) => t.category === c).length;
          const noteCount = (os.brainNotes[c] || []).length;
          return (
            <button key={c} className="brain-tile" onClick={() => setBrainCat(c)}>
              <div className="tile-name">{c}</div>
              <div className="tile-meta">{count} open · {noteCount} notes</div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>
          );
        })}
      </div>
    );
  }

  function renderHabits() {
    return (
      <div className="habit-stack">
        {os.habits.map((h) => {
          const done = h.subtasks.filter((s) => s.done).length;
          const full = done === h.subtasks.length && h.subtasks.length;
          return (
            <div key={h.id} className={full ? "panel habit full" : "panel habit"}>
              <div className="panel-head">
                <div className="panel-title">{full ? <Check size={14} color="var(--teal)" /> : null} {h.name}</div>
                <span className="count">{done}/{h.subtasks.length}</span>
              </div>
              <div className="sub-list">
                {h.subtasks.map((s) => (
                  <button key={s.id} className={s.done ? "subtask on" : "subtask"} onClick={() => toggleSub(h.id, s.id)}>
                    <span className="sbox">{s.done && <Check size={11} />}</span>{s.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderNutrition() {
    const tMeals = os.meals;
    const cals = tMeals.reduce((a, b) => a + b.calories, 0);
    const pro = tMeals.reduce((a, b) => a + b.protein, 0);
    return (
      <div>
        <div className="macro-row">
          <div className="macro"><div className="macro-num mono">{cals}</div><div className="macro-lab">calories today</div></div>
          <div className="macro"><div className="macro-num mono">{pro}g</div><div className="macro-lab">protein today</div></div>
          <div className="macro"><div className="macro-num mono">{tMeals.length}</div><div className="macro-lab">meals logged</div></div>
        </div>
        <div className="note-add" style={{ margin: "14px 0" }}>
          <input className="inp" placeholder="What did you eat? e.g. chicken and rice" value={mealText} onChange={(e) => setMealText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") logMeal(); }} />
          <button className="solid-btn wide" onClick={logMeal} disabled={mealLoading}>{mealLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Log</button>
        </div>
        <div className="panel">
          {tMeals.length === 0 && <div className="empty">No meals yet today. Claude estimates calories and protein for you.</div>}
          <div className="list">
            {tMeals.map((m) => (
              <div key={m.id} className="row meal">
                <span className="meal-time mono">{m.time}</span>
                <span className="row-title">{m.name}</span>
                <span className="meal-mac mono">{m.calories} kcal · {m.protein}g</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderJournal() {
    return (
      <div>
        <div className="panel">
          <div className="panel-head"><div className="panel-title"><BookOpen size={14} /> Tonight's entry</div></div>
          <textarea className="ta" placeholder="How was the day? Wins, struggles, what you learned. Speak or type." value={jText} onChange={(e) => setJText(e.target.value)} />
          <div className="j-actions">
            <button className={jVoice === "listening" ? "ghost-btn rec" : "ghost-btn"} onClick={() => startVoice((t) => setJText((p) => (p ? p + " " : "") + t), setJVoice)}>
              <Mic size={14} /> {jVoice === "listening" ? "Listening" : jVoice === "unsupported" ? "Voice n/a" : "Speak"}
            </button>
            <button className="solid-btn wide" onClick={saveJournal} disabled={jSaving}>{jSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Save entry</button>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><div className="panel-title">Log</div></div>
          {os.journal.length === 0 && <div className="empty">Your daily entries build the memory the AI learns from.</div>}
          {os.journal.map((j) => <JournalRow key={j.id} j={j} />)}
        </div>
      </div>
    );
  }

  function renderGoals() {
    return (
      <div>
        <div className="note-add" style={{ marginBottom: 14 }}>
          <input className="inp" placeholder="New goal" value={goalText} onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addGoal(goalText, goalScope); setGoalText(""); } }} />
          <div className="scope-toggle">
            {["week", "month"].map((s) => <button key={s} className={goalScope === s ? "chip on" : "chip"} onClick={() => setGoalScope(s)}>{s}</button>)}
          </div>
          <button className="solid-btn" onClick={() => { addGoal(goalText, goalScope); setGoalText(""); }}><Plus size={14} /></button>
        </div>
        <div className="goals-grid">
          {["week", "month"].map((sc) => (
            <div key={sc} className="panel">
              <div className="panel-head"><div className="panel-title">This {sc}</div></div>
              {os.goals.filter((g) => g.scope === sc).length === 0 && <div className="empty">No {sc} goals yet.</div>}
              {os.goals.filter((g) => g.scope === sc).map((g) => (
                <div key={g.id} className={g.done ? "goal done full" : "goal full"}>
                  <span className="goal-box" onClick={() => toggleGoal(g.id)}>{g.done && <Check size={11} />}</span>
                  <span style={{ flex: 1 }} onClick={() => toggleGoal(g.id)}>{g.text}</span>
                  <button className="icon-btn faint" onClick={() => delGoal(g.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderFinance() {
    const spent = os.spend?.spent || 0;
    const limit = os.spend?.limit || 4928;
    const remaining = limit - spent;
    const pctSpent = limit ? Math.min(100, (spent / limit) * 100) : 0;
    const status = pctSpent >= 100 ? "over" : pctSpent >= 85 ? "warn" : "ok";
    const statusColor = status === "over" ? "var(--accent)" : status === "warn" ? "var(--gold)" : "var(--accent)";
    const barColor = status === "over" ? "#e2544f" : status === "warn" ? "var(--gold)" : "var(--accent)";
    const history = (os.spend?.history || []).map((h) => ({ value: h.spent }));
    return (
      <div style={{ maxWidth: 640 }}>
        <div className="panel">
          <div className="plabel"><span className="num">08</span> MONTHLY SPEND <span className="pcount mono">{os.spend?.month}</span></div>
          <div className="net big mono" style={{ color: barColor }}>${spent.toLocaleString()}</div>
          <div className="net-label">of ${limit.toLocaleString()} limit</div>
          <div className="spend-bar"><span style={{ width: pctSpent + "%", background: barColor }} /></div>
          <div className="spend-foot mono">
            <span style={{ color: barColor }}>{Math.round(pctSpent)}% used</span>
            <span>{remaining >= 0 ? `$${remaining.toLocaleString()} left` : `$${Math.abs(remaining).toLocaleString()} over`}</span>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="plabel"><span className="num">09</span> UPDATE</div>
          <input ref={spendFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => importSpendShot(e.target.files && e.target.files[0])} />
          <button className="solid-btn wide" style={{ marginBottom: 14 }} onClick={() => spendFileRef.current && spendFileRef.current.click()} disabled={impSpend}>
            {impSpend ? <Loader2 size={14} className="spin" /> : <Camera size={14} />} Import statement screenshot
          </button>
          <div className="sub-label">Month to date spend</div>
          <div className="note-add">
            <input className="inp" inputMode="decimal" placeholder={`Current spend, e.g. ${spent}`} value={spentInput} onChange={(e) => setSpentInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setSpend(spentInput); setSpentInput(""); } }} />
            <button className="solid-btn" onClick={() => { setSpend(spentInput); setSpentInput(""); }}>Save</button>
          </div>
          <div className="sub-label">Monthly limit</div>
          <div className="note-add">
            <input className="inp" inputMode="decimal" placeholder={`${limit}`} value={limitInput} onChange={(e) => setLimitInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setLimit(limitInput); setLimitInput(""); } }} />
            <button className="ghost-btn" onClick={() => { setLimit(limitInput); setLimitInput(""); }}>Set limit</button>
          </div>
        </div>

        {history.length >= 2 && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="plabel"><span className="num">10</span> TREND</div>
            <Spark history={history.slice(0, -1)} current={spent} big />
          </div>
        )}
      </div>
    );
  }

  const VIEWS = { home: renderHome, crm: renderCrm, brain: renderBrain, habits: renderHabits, nutrition: renderNutrition, journal: renderJournal, goals: renderGoals, finance: renderFinance };
  const title = NAV.find((n) => n.id === view)?.label;

  return (
    <>
      <Style />
      <div className="os">
        <header className="topbar">
          <div className="brand"><span className="brand-mark" /><span className="brand-name">HAYDEN OS</span><span className="brand-ver">// V1</span></div>
          <nav className="topnav">
            {NAV.map((n) => (
              <button key={n.id} className={view === n.id ? "tab on" : "tab"} onClick={() => { setView(n.id); setBrainCat(null); }}>{n.label}</button>
            ))}
          </nav>
          <div className="topstat">
            <span className="ts-date">{now.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</span>
            <span className="ts-time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
            <span className="ts-live"><span className="dot" /> LIVE</span>
          </div>
        </header>

        <main className="os-main">
          {view !== "home" && <div className="view-head"><h1>{title}</h1></div>}
          <div className="view-body">{VIEWS[view]()}</div>
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

/* ---------- pieces ---------- */
function SpendPanel({ spent, limit, history }) {
  const remaining = limit - spent;
  const pctSpent = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = pctSpent >= 100, warn = pctSpent >= 85;
  const barColor = over ? "#e2544f" : warn ? "var(--gold)" : "var(--accent)";
  return (
    <div className="panel">
      <div className="plabel"><span className="num">0S</span> SPEND <span className="pcount mono">MONTH</span></div>
      <div className="net mono" style={{ color: barColor }}>${spent.toLocaleString()}</div>
      <div className="net-label">of ${limit.toLocaleString()} limit</div>
      <div className="spend-bar"><span style={{ width: pctSpent + "%", background: barColor }} /></div>
      <div className="spend-foot mono">
        <span style={{ color: barColor }}>{Math.round(pctSpent)}%</span>
        <span>{remaining >= 0 ? `$${remaining.toLocaleString()} left` : `$${Math.abs(remaining).toLocaleString()} over`}</span>
      </div>
    </div>
  );
}

function Ring({ pct }) {
  const r = 46, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="ring">
      <circle cx="60" cy="60" r={r} stroke="var(--bg3)" strokeWidth="9" fill="none" />
      <circle cx="60" cy="60" r={r} stroke="var(--teal)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset .5s ease" }} />
      <text x="60" y="58" textAnchor="middle" className="ring-num">{pct}%</text>
      <text x="60" y="76" textAnchor="middle" className="ring-sub">today</text>
    </svg>
  );
}

function Spark({ history, current, big }) {
  const pts = [...(history || []).map((h) => h.value), current];
  if (pts.length < 2) return <div className="spark-empty">Log two months to see the trend.</div>;
  const w = 260, h = big ? 70 : 46, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = w / (pts.length - 1);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / span) * (h - 10) - 5).toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <defs><linearGradient id="sparkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#sparkg)" stroke="none" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.75" />
    </svg>
  );
}

function JournalRow({ j }) {
  const [raw, setRaw] = useState(false);
  return (
    <div className="j-row">
      <div className="j-top">
        <span className="j-date mono">{j.date}</span>
        <button className="link-btn" onClick={() => setRaw((r) => !r)}>{raw ? "hide raw" : "show raw"}</button>
      </div>
      <div className="j-sum">{j.summary}</div>
      {raw && <div className="j-raw">{j.text}</div>}
    </div>
  );
}

/* ---------- styles ---------- */
function Style() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#05080d; --bg2:#0a0f16; --bg3:#10161f; --line:#182029; --line2:#232d38;
  --text:#e6ecf2; --muted:#7b8794; --faint:#4b5563;
  --accent:#35d6be; --accent2:#2bb89f; --gold:#d9b46a; --blue:#5a93d4;
  --accent-dim:rgba(53,214,190,.12); --accent-dim2:rgba(53,214,190,.06); --gold-dim:rgba(217,180,106,.12);
  --sans:'Inter',system-ui,sans-serif; --serif:'Newsreader',Georgia,serif; --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.os{min-height:100vh;background:radial-gradient(1200px 600px at 70% -10%,rgba(53,214,190,.05),transparent),var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;display:flex;flex-direction:column}
.os .mono{font-family:var(--mono)}
.os .serif{font-family:var(--serif)}
.os.boot{align-items:center;justify-content:center;gap:12px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

/* top bar */
.topbar{display:flex;align-items:center;gap:22px;padding:0 22px;height:52px;background:rgba(8,12,18,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.brand{display:flex;align-items:center;gap:8px;flex:none}
.brand-mark{width:11px;height:11px;border-radius:3px;background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 0 12px var(--accent-dim)}
.brand-name{font-family:var(--mono);font-weight:500;font-size:13px;letter-spacing:.14em}
.brand-ver{font-family:var(--mono);font-size:11px;color:var(--faint);letter-spacing:.1em}
.topnav{display:flex;gap:2px;flex:1;overflow-x:auto}
.tab{background:none;border:none;color:var(--muted);font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:.15s}
.tab:hover{color:var(--text)}
.tab.on{color:var(--text);background:var(--accent-dim);box-shadow:inset 0 -2px 0 var(--accent)}
.topstat{display:flex;align-items:center;gap:14px;flex:none;font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--muted)}
.ts-time{color:var(--text)}
.ts-live{display:flex;align-items:center;gap:6px;color:var(--accent)}
.ts-live .dot,.live .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent)}

/* main */
.os-main{flex:1;min-width:0;padding:18px 22px 40px;max-width:1500px;width:100%;margin:0 auto}
.view-head{padding:6px 2px 16px}
.view-head h1{margin:0;font-family:var(--serif);font-weight:500;font-size:26px;letter-spacing:-.01em}

/* columns */
.cols{display:grid;grid-template-columns:320px minmax(0,1fr) 320px;gap:14px;align-items:start}
.col{display:flex;flex-direction:column;gap:14px;min-width:0}

/* panel */
.panel{background:linear-gradient(var(--bg2),var(--bg2)) padding-box;border:1px solid var(--line);border-radius:12px;padding:16px}
.plabel{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.plabel .num{color:var(--accent);opacity:.8}
.plabel .live{margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--accent);letter-spacing:.1em}
.pcount{margin-left:auto;color:var(--faint);letter-spacing:.08em}
.empty{color:var(--faint);font-size:13px;padding:6px 2px;line-height:1.5}

/* legacy panel head/title (other views) */
.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.panel-title{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-weight:500;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text)}
.panel-title svg{color:var(--accent)}
.count{font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--bg3);padding:2px 8px;border-radius:20px}
.sub-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:16px 0 8px;font-family:var(--mono)}

/* operator */
.op-name{font-family:var(--serif);font-weight:500;font-size:28px;letter-spacing:-.01em;line-height:1.05}
.op-sub{color:var(--muted);font-size:12.5px;margin-top:5px}
.op-meta{display:flex;gap:22px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
.mk{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:5px}
.mv{font-size:14px;color:var(--text)}
.mv.serif{font-style:italic;font-size:15px}
.mv.mono{font-size:16px}

/* session greeting */
.session{background:radial-gradient(500px 200px at 90% -30%,var(--accent-dim2),transparent),var(--bg2)}
.greeting{font-family:var(--serif);font-weight:400;font-size:30px;letter-spacing:-.01em;line-height:1.15}
.g-name{font-style:italic}
.sess-date{color:var(--muted);font-size:12.5px;margin-top:4px}
.cap{display:flex;gap:8px;margin-top:16px}
.cap-inp{flex:1;background:var(--bg3);border:1px solid var(--line);border-radius:9px;padding:11px 13px;color:var(--text);font-family:var(--sans);font-size:13.5px;outline:none;min-width:0;transition:.15s}
.cap-inp:focus{border-color:var(--accent)}.cap-inp::placeholder{color:var(--faint)}
.cap-mic{flex:none;width:40px;border-radius:9px;background:var(--bg3);border:1px solid var(--line);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.cap-mic:hover{color:var(--text)}.cap-mic.rec{color:var(--accent);border-color:var(--accent)}
.cap-go{flex:none;background:var(--accent);color:#04201c;border:none;border-radius:9px;padding:0 16px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;cursor:pointer;display:flex;align-items:center;transition:.15s}
.cap-go:hover{filter:brightness(1.08)}.cap-go:disabled{opacity:.6}

/* finance / spend */
.net{font-family:var(--mono);font-size:27px;letter-spacing:-.02em}
.net.big{font-size:38px}
.net-label{color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin:2px 0 10px;font-family:var(--mono)}
.spend-bar{height:8px;border-radius:5px;background:var(--bg3);overflow:hidden;margin:4px 0 10px}
.spend-bar span{display:block;height:100%;border-radius:5px;transition:width .4s ease}
.spend-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);letter-spacing:.04em}
.hidden-net{display:flex;align-items:center;gap:7px;padding:10px 0}
.hidden-net span{width:30px;height:10px;border-radius:3px;background:repeating-linear-gradient(90deg,var(--bg3),var(--bg3) 4px,var(--bg2) 4px,var(--bg2) 8px)}
.hidden-label{color:var(--faint);font-size:12px;margin-left:8px}
.spark{display:block;margin-top:8px}.spark-empty{color:var(--faint);font-size:12px;margin-top:8px}

/* schedule reminder */
.reminder{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-top:12px;background:var(--bg3);border:1px solid var(--line);border-radius:9px;padding:10px 12px;cursor:pointer;color:var(--text);transition:.15s;font-family:var(--sans)}
.reminder:hover{border-color:var(--line2)}
.reminder.due{border-color:var(--accent);background:var(--accent-dim)}
.reminder.done{opacity:.7}
.rem-box{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line2);display:flex;align-items:center;justify-content:center;color:var(--accent);flex:none}
.reminder.done .rem-box{background:var(--accent-dim);border-color:var(--accent)}
.reminder.due .rem-box{border-color:var(--accent)}
.rem-text{flex:1;font-size:13px}
.reminder.done .rem-text{text-decoration:line-through;color:var(--muted)}
.rem-tag{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);flex:none}
.reminder.due .rem-tag{color:var(--accent)}

/* habit cards */
.habit-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hcard{text-align:left;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:13px;cursor:pointer;transition:.15s;color:var(--text)}
.hcard:hover{border-color:var(--line2)}
.hcard.full{border-color:var(--accent);background:var(--accent-dim2)}
.hc-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hc-name{font-size:13px;font-weight:500}
.hc-bar{height:4px;border-radius:3px;background:var(--line);margin:11px 0 8px;overflow:hidden}
.hc-bar span{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .4s ease}
.hc-frac{font-size:11px;color:var(--faint)}

/* calendar */
.cal-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal-day{text-align:center;padding:9px 0;border-radius:8px;border:1px solid var(--line);background:var(--bg3)}
.cal-day.on{border-color:var(--accent);background:var(--accent-dim)}
.cal-dow{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--faint)}
.cal-day.on .cal-dow{color:var(--accent)}
.cal-num{font-size:15px;margin-top:3px}
.cal-agenda{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}

/* nutrition summary */
.nut-big{font-size:34px;letter-spacing:-.02em;display:flex;align-items:baseline;gap:6px}
.nut-unit{font-size:12px;color:var(--muted);letter-spacing:0}
.nut-sub{font-size:12px;color:var(--muted);margin-top:2px}

/* rows / lists */
.list{display:flex;flex-direction:column;gap:2px}
.row{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;transition:.12s}
.row:hover{background:var(--bg3)}
.row-title{flex:1;font-size:13.5px;line-height:1.4;min-width:0}
.strike{color:var(--faint);text-decoration:line-through}
.check{flex:none;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line2);background:none;color:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.check:hover{border-color:var(--accent);color:var(--accent)}
.check.on{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
.star{flex:none;background:none;border:none;color:var(--faint);cursor:pointer;display:flex;padding:2px}
.star:hover{color:var(--gold)}.star.on{color:var(--gold)}.star.on svg{fill:var(--gold)}
.pill{font-size:10px;font-weight:500;border:1px solid;border-radius:20px;padding:2px 9px;text-transform:capitalize;flex:none;font-family:var(--mono);letter-spacing:.04em}
.tag{font-size:10.5px;color:var(--muted);background:var(--bg3);padding:2px 9px;border-radius:6px;flex:none;font-family:var(--mono)}
.dot-pri{width:7px;height:7px;border-radius:50%;flex:none}
.icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:5px;border-radius:6px;transition:.12s}
.icon-btn:hover{color:var(--text);background:var(--bg3)}.icon-btn.faint{color:var(--faint)}
.ghost-btn{display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:6px 11px;border-radius:8px;cursor:pointer;transition:.15s}
.ghost-btn:hover{border-color:var(--line2)}.ghost-btn:disabled{opacity:.6}.ghost-btn.rec{color:var(--accent);border-color:var(--accent)}
.ghost-btn.sm{margin-left:auto;padding:4px 9px;font-size:10px}
.solid-btn{display:flex;align-items:center;gap:6px;background:var(--accent);color:#04201c;border:none;font-weight:500;font-family:var(--mono);font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:9px 13px;border-radius:9px;cursor:pointer;flex:none;transition:.15s}
.solid-btn.wide{padding:9px 16px}.solid-btn:hover{filter:brightness(1.06)}.solid-btn:disabled{opacity:.6}

/* advice */
.advice p{margin:0 0 7px;font-size:13.5px;line-height:1.55;color:var(--text)}.advice p:last-child{margin:0}

/* goals */
.goal-block{margin-bottom:16px}.goal-block:last-child{margin-bottom:0}
.goals-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.goal-scope{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:9px;font-family:var(--mono)}
.goal{display:flex;align-items:center;gap:9px;font-size:13px;padding:6px 0;color:var(--muted);cursor:pointer}
.goal.full{padding:8px 0}.goal:hover{color:var(--text)}
.goal.done{color:var(--faint);text-decoration:line-through}
.goal-box{width:17px;height:17px;border-radius:5px;border:1.5px solid var(--line2);display:flex;align-items:center;justify-content:center;color:var(--accent);flex:none}
.goal.done .goal-box{background:var(--accent-dim);border-color:var(--accent)}

/* chips */
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
.chip{background:var(--bg2);border:1px solid var(--line);color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:.04em;padding:6px 12px;border-radius:20px;cursor:pointer;transition:.15s}
.chip:hover{color:var(--text)}.chip.on{background:var(--accent-dim);border-color:var(--accent);color:var(--text)}
.scope-toggle{display:flex;gap:5px}

/* brain */
.brain-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.brain-tile{position:relative;text-align:left;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:18px 16px;cursor:pointer;transition:.15s;color:var(--text)}
.brain-tile:hover{border-color:var(--accent);transform:translateY(-2px)}
.tile-name{font-family:var(--serif);font-weight:500;font-size:17px}
.tile-meta{color:var(--faint);font-size:11px;margin-top:6px;font-family:var(--mono);letter-spacing:.04em}
.tile-arrow{position:absolute;top:18px;right:14px;color:var(--faint)}
.back{display:flex;align-items:center;gap:5px;background:none;border:none;color:var(--muted);cursor:pointer;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:12px;padding:4px 0}
.back:hover{color:var(--text)}
.note-add{display:flex;gap:8px;align-items:center}
.inp{flex:1;background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none}
.inp:focus{border-color:var(--accent)}.inp::placeholder{color:var(--faint)}
.row.note{background:var(--bg3);margin-top:4px}

/* habits page */
.habit-stack{display:flex;flex-direction:column;gap:12px}
.habit.full{border-color:var(--accent)}
.sub-list{display:flex;flex-wrap:wrap;gap:8px}
.subtask{display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:8px 12px;color:var(--muted);font-family:var(--sans);font-size:13px;cursor:pointer;transition:.15s}
.subtask:hover{color:var(--text);border-color:var(--line2)}
.subtask.on{color:var(--text);border-color:var(--accent)}
.sbox{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--line2);display:flex;align-items:center;justify-content:center;color:var(--accent);flex:none}
.subtask.on .sbox{background:var(--accent-dim);border-color:var(--accent)}

/* nutrition page */
.macro-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.macro{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center}
.macro-num{font-size:26px;letter-spacing:-.02em;font-family:var(--mono)}
.macro-lab{color:var(--faint);font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;font-family:var(--mono)}
.row.meal{background:var(--bg2);border:1px solid var(--line);margin-bottom:6px;border-radius:9px}
.meal-time{font-size:11px;color:var(--faint);flex:none;width:54px}
.meal-mac{font-size:11.5px;color:var(--muted);flex:none}

/* journal */
.ta{width:100%;min-height:120px;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:13px;color:var(--text);font-family:var(--sans);font-size:13.5px;line-height:1.55;outline:none;resize:vertical}
.ta:focus{border-color:var(--accent)}.ta::placeholder{color:var(--faint)}
.j-actions{display:flex;gap:9px;margin-top:11px;justify-content:flex-end}
.j-row{padding:13px 0;border-bottom:1px solid var(--line)}.j-row:last-child{border:none}
.j-top{display:flex;align-items:center;gap:11px;margin-bottom:6px}
.j-date{font-size:11px;color:var(--faint)}
.link-btn{background:none;border:none;color:var(--accent);font-family:var(--mono);font-size:11px;cursor:pointer;padding:0;letter-spacing:.04em}
.j-sum{font-size:13.5px;line-height:1.5}
.j-raw{margin-top:9px;padding:11px;background:var(--bg3);border-radius:8px;font-size:13px;line-height:1.6;color:var(--muted);white-space:pre-wrap}

/* ring (kept for compatibility) */
.ring-num{fill:var(--text);font-family:var(--mono);font-size:21px}
.ring-sub{fill:var(--faint);font-size:9px;letter-spacing:.1em;text-transform:uppercase}

/* toast */
.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--bg3);border:1px solid var(--line2);color:var(--text);padding:11px 18px;border-radius:10px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:50}

@media(max-width:1080px){ .cols{grid-template-columns:1fr} }
@media(max-width:760px){
  .topbar{gap:12px;padding:0 12px}
  .os-main{padding:14px 12px 40px}
  .goals-grid,.brain-grid,.macro-row,.habit-cards{grid-template-columns:1fr}
  .greeting{font-size:25px}
}
`}</style>
  );
}
