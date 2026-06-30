"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Home, ListTodo, Brain, Flame, Utensils, BookOpen, Target, Wallet,
  Mic, Plus, Star, Check, Sparkles, Eye, EyeOff, Trash2, Loader2,
  X, ChevronRight, TrendingUp, Zap,
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
  async function addAccount(name, value) {
    if (!name.trim()) return;
    const r = await mutate("account.add", { name: name.trim(), value });
    patch((p) => { p.finance.accounts = [...p.finance.accounts, { id: r.id || uid(), name: name.trim(), value: Number(value) || 0 }]; return p; });
  }
  function delAccount(id) {
    patch((p) => { p.finance.accounts = p.finance.accounts.filter((a) => a.id !== id); return p; });
    mutate("account.delete", { id });
  }
  function snapshot() {
    const net = os.finance.accounts.reduce((a, b) => a + (Number(b.value) || 0), 0);
    const day = new Date().toISOString().slice(0, 10);
    patch((p) => { p.finance.history = [...p.finance.history.filter((h) => h.date !== day), { date: day, value: net }]; return p; });
    mutate("finance.snapshot", {}); flash("Snapshot saved.");
  }

  /* ---------- capture ---------- */
  const [capText, setCapText] = useState("");
  const [capLoading, setCapLoading] = useState(false);
  const [capVoice, setCapVoice] = useState("idle");
  async function capture() {
    if (!capText.trim()) return;
    setCapLoading(true);
    const r = await post("/api/capture", { text: capText.trim() });
    if (r.task) { patch((p) => { p.tasks = [r.task, ...p.tasks]; return p; }); flash(`Filed under ${r.task.category}, ${r.task.priority} priority`); }
    else flash("Could not file that. Try again.");
    setCapText(""); setCapLoading(false);
  }

  /* ---------- strategic ---------- */
  const [advice, setAdvice] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  async function getAdvice() {
    setAdviceLoading(true); setAdvice("");
    const r = await post("/api/advice", {});
    setAdvice(r.advice || "Claude is not reachable right now. Try again in a moment.");
    setAdviceLoading(false);
  }

  /* ---------- nutrition ---------- */
  const [mealText, setMealText] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  async function logMeal() {
    if (!mealText.trim()) return;
    setMealLoading(true);
    const r = await post("/api/meal", { text: mealText.trim() });
    if (r.meal) patch((p) => { p.meals = [r.meal, ...p.meals]; return p; });
    setMealText(""); setMealLoading(false);
  }

  /* ---------- journal ---------- */
  const [jText, setJText] = useState("");
  const [jVoice, setJVoice] = useState("idle");
  const [jSaving, setJSaving] = useState(false);
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
    const net = os.finance.accounts.reduce((a, b) => a + (Number(b.value) || 0), 0);
    return (
      <div className="grid">
        <div className="panel span2">
          <div className="op-row">
            <div>
              <div className="eyebrow">Operator</div>
              <div className="op-name">{os.profile.name}</div>
              <div className="op-sub">{os.profile.role}{os.profile.org ? ` at ${os.profile.org}` : ""}</div>
            </div>
            <div className="op-clock">
              <div className="clock-time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="clock-date">{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</div>
              <div className="live"><span className="dot" /> systems online</div>
            </div>
          </div>
        </div>

        <FinancePulse net={net} history={os.finance.history} />

        <div className="panel">
          <div className="panel-head"><div className="panel-title"><Star size={14} /> Key tasks</div><span className="count">{keyTasks.length}</span></div>
          {keyTasks.length === 0 && <div className="empty">Star 3 to 5 tasks to set today's priorities.</div>}
          <div className="list">
            {keyTasks.map((t) => (
              <div key={t.id} className="row">
                <button className="check" onClick={() => completeTask(t.id)}><Check size={13} /></button>
                <span className="row-title">{t.title}</span>
                <span className="pill" style={{ color: priColor(t.priority), borderColor: priColor(t.priority) }}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div className="panel-title"><Flame size={14} /> Daily habits</div></div>
          <div className="ring-wrap">
            <Ring pct={pct} />
            <div className="ring-legend">
              {os.habits.map((h) => {
                const done = h.subtasks.filter((s) => s.done).length;
                return (
                  <div key={h.id} className="legend-row">
                    <span className={done === h.subtasks.length && h.subtasks.length ? "leg-dot done" : "leg-dot"} />
                    <span className="leg-name">{h.name}</span>
                    <span className="leg-frac">{done}/{h.subtasks.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel span2">
          <div className="panel-head">
            <div className="panel-title"><Zap size={14} /> Strategic read</div>
            <button className="ghost-btn" onClick={getAdvice} disabled={adviceLoading}>
              {adviceLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
              {adviceLoading ? "Thinking" : "Top 3 right now"}
            </button>
          </div>
          {!advice && !adviceLoading && <div className="empty">Ask Claude what to prioritize across every task and goal.</div>}
          {advice && <div className="advice">{advice.split("\n").filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>}
        </div>

        <div className="panel span2">
          <div className="panel-head"><div className="panel-title"><Target size={14} /> Goals</div></div>
          <div className="goals-grid">
            {["week", "month"].map((sc) => (
              <div key={sc} className="goal-col">
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
        </div>
      </div>
    );
  }

  function FinancePulse({ net, history }) {
    const [show, setShow] = useState(false);
    return (
      <div className="panel finance-pulse">
        <div className="panel-head">
          <div className="panel-title"><Wallet size={14} /> Finance pulse</div>
          <button className="icon-btn" onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
        {show ? (
          <div>
            <div className="net">${net.toLocaleString()}</div>
            <div className="net-label">net worth</div>
            <Spark history={history} current={net} />
          </div>
        ) : (
          <div className="hidden-net"><span /><span /><span /><div className="hidden-label">tap the eye to reveal</div></div>
        )}
      </div>
    );
  }

  const [crmFilter, setCrmFilter] = useState("All");
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

  const [brainCat, setBrainCat] = useState(null);
  const [brainSummary, setBrainSummary] = useState("");
  const [brainLoading, setBrainLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
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

  const [goalText, setGoalText] = useState("");
  const [goalScope, setGoalScope] = useState("week");
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

  const [accName, setAccName] = useState("");
  const [accVal, setAccVal] = useState("");
  function renderFinance() {
    const net = os.finance.accounts.reduce((a, b) => a + (Number(b.value) || 0), 0);
    return (
      <div>
        <div className="panel">
          <div className="panel-head"><div className="panel-title"><TrendingUp size={14} /> Net worth</div>
            <button className="ghost-btn" onClick={snapshot}><Plus size={13} /> Snapshot</button>
          </div>
          <div className="net big">${net.toLocaleString()}</div>
          <Spark history={os.finance.history} current={net} big />
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><div className="panel-title">Accounts</div></div>
          <div className="note-add">
            <input className="inp" placeholder="Account name" value={accName} onChange={(e) => setAccName(e.target.value)} />
            <input className="inp" style={{ maxWidth: 130 }} placeholder="Value" inputMode="decimal" value={accVal} onChange={(e) => setAccVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addAccount(accName, accVal); setAccName(""); setAccVal(""); } }} />
            <button className="solid-btn" onClick={() => { addAccount(accName, accVal); setAccName(""); setAccVal(""); }}><Plus size={14} /></button>
          </div>
          {os.finance.accounts.length === 0 && <div className="empty">Add your accounts to build your net worth.</div>}
          <div className="list">
            {os.finance.accounts.map((a) => (
              <div key={a.id} className="row">
                <span className="row-title">{a.name}</span>
                <span className="mono">${Number(a.value).toLocaleString()}</span>
                <button className="icon-btn faint" onClick={() => delAccount(a.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const VIEWS = { home: renderHome, crm: renderCrm, brain: renderBrain, habits: renderHabits, nutrition: renderNutrition, journal: renderJournal, goals: renderGoals, finance: renderFinance };
  const title = NAV.find((n) => n.id === view)?.label;

  return (
    <>
      <Style />
      <div className="os">
        <aside className="os-sidebar">
          <div className="brand"><span className="brand-mark" /><span className="brand-name">HaydenOS</span></div>
          <nav>
            {NAV.map((n) => {
              const I = n.icon;
              return (
                <button key={n.id} className={view === n.id ? "nav on" : "nav"} onClick={() => { setView(n.id); setBrainCat(null); }}>
                  <I size={17} /><span className="os-navlabel">{n.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="os-main">
          <div className="capture-bar">
            <Sparkles size={15} className="cap-spark" />
            <input
              className="capture-inp"
              placeholder="Capture anything. Claude sorts it into the right place."
              value={capText}
              onChange={(e) => setCapText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") capture(); }}
            />
            <button className={capVoice === "listening" ? "cap-mic rec" : "cap-mic"} onClick={() => startVoice((t) => setCapText((p) => (p ? p + " " : "") + t), setCapVoice)} title="Voice capture">
              <Mic size={16} />
            </button>
            <button className="cap-btn" onClick={capture} disabled={capLoading}>
              {capLoading ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Capture
            </button>
          </div>
          <div className="view-head"><h1>{title}</h1></div>
          <div className="view-body">{VIEWS[view]()}</div>
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

/* ---------- pieces ---------- */
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
  if (pts.length < 2) return <div className="spark-empty">Take a snapshot to start the trend.</div>;
  const w = 260, h = big ? 70 : 44, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / span) * (h - 8) - 4).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth="2" />
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
:root{
  --bg:#0a0d14; --bg2:#0f131d; --bg3:#161c29; --border:#1d2433; --border2:#2a3346;
  --text:#e7ecf5; --muted:#8893a8; --faint:#5b6478;
  --accent:#e23a52; --gold:#e0a850; --teal:#34c6d8; --blue:#5a93d4;
  --accent-dim:rgba(226,58,82,.13); --teal-dim:rgba(52,198,216,.12); --gold-dim:rgba(224,168,80,.12);
  --sans:'Inter',system-ui,sans-serif; --disp:'Space Grotesk',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.os{display:flex;min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px}
.os .mono{font-family:var(--mono)}
.os.boot{align-items:center;justify-content:center;gap:12px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.os-sidebar{width:204px;flex:none;background:var(--bg2);border-right:1px solid var(--border);padding:18px 12px;display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:9px;padding:4px 8px 16px}
.brand-mark{width:13px;height:13px;border-radius:4px;background:linear-gradient(135deg,var(--accent),var(--teal));box-shadow:0 0 12px var(--accent-dim)}
.brand-name{font-family:var(--disp);font-weight:700;letter-spacing:-.02em;font-size:15px}
.nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;background:none;border:none;color:var(--muted);cursor:pointer;font-family:var(--sans);font-size:13.5px;font-weight:500;width:100%;text-align:left;transition:.15s}
.nav:hover{background:var(--bg3);color:var(--text)}
.nav.on{background:var(--accent-dim);color:var(--text)}.nav.on svg{color:var(--accent)}
.os-main{flex:1;min-width:0;display:flex;flex-direction:column}
.capture-bar{display:flex;align-items:center;gap:9px;padding:14px 22px;background:var(--bg2);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.cap-spark{color:var(--teal);flex:none}
.capture-inp{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:10px 13px;color:var(--text);font-family:var(--sans);font-size:13.5px;outline:none;transition:.15s;min-width:0}
.capture-inp:focus{border-color:var(--teal)}.capture-inp::placeholder{color:var(--faint)}
.cap-mic{flex:none;width:38px;height:38px;border-radius:9px;background:var(--bg3);border:1px solid var(--border);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.cap-mic:hover{color:var(--text);border-color:var(--border2)}
.cap-mic.rec{color:var(--accent);border-color:var(--accent)}
.cap-btn{flex:none;display:flex;align-items:center;gap:6px;background:var(--accent);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-family:var(--sans);font-weight:600;font-size:13px;cursor:pointer;transition:.15s}
.cap-btn:hover{filter:brightness(1.08)}.cap-btn:disabled{opacity:.6;cursor:default}
.view-head{padding:20px 22px 4px}
.view-head h1{margin:0;font-family:var(--disp);font-weight:600;font-size:23px;letter-spacing:-.02em}
.view-body{padding:14px 22px 40px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.span2{grid-column:1 / -1}
.panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px}
.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.panel-title{display:flex;align-items:center;gap:7px;font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--text)}
.panel-title svg{color:var(--muted)}
.count{font-family:var(--mono);font-size:12px;color:var(--muted);background:var(--bg3);padding:2px 8px;border-radius:20px}
.eyebrow{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:7px}
.empty{color:var(--faint);font-size:13px;padding:8px 2px;line-height:1.5}
.sub-label{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:16px 0 8px}
.op-row{display:flex;justify-content:space-between;align-items:flex-start}
.op-name{font-family:var(--disp);font-weight:700;font-size:26px;letter-spacing:-.02em;line-height:1.1}
.op-sub{color:var(--muted);font-size:13px;margin-top:3px}
.op-clock{text-align:right}
.clock-time{font-family:var(--mono);font-size:22px;letter-spacing:-.01em}
.clock-date{color:var(--muted);font-size:12px;margin-top:2px}
.live{display:flex;align-items:center;justify-content:flex-end;gap:6px;font-size:11px;color:var(--teal);margin-top:8px}
.live .dot{width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 8px var(--teal)}
.finance-pulse .net{font-family:var(--mono);font-size:26px;letter-spacing:-.02em}
.net.big{font-size:38px}
.net-label{color:var(--muted);font-size:11px;letter-spacing:.05em;margin:2px 0 8px}
.hidden-net{display:flex;align-items:center;gap:7px;padding:12px 0}
.hidden-net span{width:34px;height:11px;border-radius:4px;background:repeating-linear-gradient(90deg,var(--bg3),var(--bg3) 4px,var(--bg2) 4px,var(--bg2) 8px)}
.hidden-label{color:var(--faint);font-size:12px;margin-left:8px}
.spark{display:block;margin-top:6px}.spark-empty{color:var(--faint);font-size:12px;margin-top:8px}
.list{display:flex;flex-direction:column;gap:2px}
.row{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;transition:.12s}
.row:hover{background:var(--bg3)}
.row-title{flex:1;font-size:13.5px;line-height:1.4;min-width:0}
.strike{color:var(--faint);text-decoration:line-through}
.check{flex:none;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border2);background:none;color:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.check:hover{border-color:var(--teal);color:var(--teal)}
.check.on{border-color:var(--teal);background:var(--teal-dim);color:var(--teal)}
.star{flex:none;background:none;border:none;color:var(--faint);cursor:pointer;display:flex;padding:2px}
.star:hover{color:var(--gold)}.star.on{color:var(--gold)}.star.on svg{fill:var(--gold)}
.pill{font-size:10.5px;font-weight:600;border:1px solid;border-radius:20px;padding:2px 9px;text-transform:capitalize;flex:none}
.tag{font-size:11px;color:var(--muted);background:var(--bg3);padding:2px 9px;border-radius:6px;flex:none}
.dot-pri{width:7px;height:7px;border-radius:50%;flex:none}
.icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:5px;border-radius:6px;transition:.12s}
.icon-btn:hover{color:var(--text);background:var(--bg3)}.icon-btn.faint{color:var(--faint)}
.ghost-btn{display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-family:var(--sans);font-size:12px;font-weight:500;padding:6px 11px;border-radius:8px;cursor:pointer;transition:.15s}
.ghost-btn:hover{border-color:var(--border2)}.ghost-btn:disabled{opacity:.6}.ghost-btn.rec{color:var(--accent);border-color:var(--accent)}
.solid-btn{display:flex;align-items:center;gap:6px;background:var(--teal);color:#04222a;border:none;font-weight:600;font-family:var(--sans);font-size:13px;padding:9px 12px;border-radius:9px;cursor:pointer;flex:none;transition:.15s}
.solid-btn.wide{padding:9px 16px}.solid-btn:hover{filter:brightness(1.06)}.solid-btn:disabled{opacity:.6}
.ring-wrap{display:flex;gap:18px;align-items:center}.ring{flex:none}
.ring-num{fill:var(--text);font-family:var(--mono);font-size:21px}
.ring-sub{fill:var(--faint);font-size:9px;letter-spacing:.1em;text-transform:uppercase}
.ring-legend{flex:1;display:flex;flex-direction:column;gap:6px}
.legend-row{display:flex;align-items:center;gap:8px;font-size:12.5px}
.leg-dot{width:7px;height:7px;border-radius:50%;background:var(--bg3);border:1px solid var(--border2);flex:none}
.leg-dot.done{background:var(--teal);border-color:var(--teal)}
.leg-name{flex:1;color:var(--muted)}.leg-frac{font-family:var(--mono);font-size:11px;color:var(--faint)}
.advice p{margin:0 0 7px;font-size:13.5px;line-height:1.5;color:var(--text)}.advice p:last-child{margin:0}
.goals-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.goal-scope{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:9px}
.goal{display:flex;align-items:center;gap:9px;font-size:13px;padding:6px 0;color:var(--muted);cursor:pointer}
.goal.full{padding:8px 0}.goal:hover{color:var(--text)}
.goal.done{color:var(--faint);text-decoration:line-through}
.goal-box{width:17px;height:17px;border-radius:5px;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;color:var(--teal);flex:none}
.goal.done .goal-box{background:var(--teal-dim);border-color:var(--teal)}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
.chip{background:var(--bg2);border:1px solid var(--border);color:var(--muted);font-family:var(--sans);font-size:12px;padding:6px 12px;border-radius:20px;cursor:pointer;transition:.15s}
.chip:hover{color:var(--text)}.chip.on{background:var(--accent-dim);border-color:var(--accent);color:var(--text)}
.scope-toggle{display:flex;gap:5px}
.brain-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.brain-tile{position:relative;text-align:left;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 16px;cursor:pointer;transition:.15s;color:var(--text)}
.brain-tile:hover{border-color:var(--border2);transform:translateY(-2px)}
.tile-name{font-family:var(--disp);font-weight:600;font-size:15px}
.tile-meta{color:var(--faint);font-size:11.5px;margin-top:6px;font-family:var(--mono)}
.tile-arrow{position:absolute;top:18px;right:14px;color:var(--faint)}
.back{display:flex;align-items:center;gap:5px;background:none;border:none;color:var(--muted);cursor:pointer;font-family:var(--sans);font-size:12.5px;margin-bottom:12px;padding:4px 0}
.back:hover{color:var(--text)}
.note-add{display:flex;gap:8px;align-items:center}
.inp{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none}
.inp:focus{border-color:var(--teal)}.inp::placeholder{color:var(--faint)}
.row.note{background:var(--bg3);margin-top:4px}
.habit-stack{display:flex;flex-direction:column;gap:12px}
.habit.full{border-color:var(--teal)}
.sub-list{display:flex;flex-wrap:wrap;gap:8px}
.subtask{display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--muted);font-family:var(--sans);font-size:13px;cursor:pointer;transition:.15s}
.subtask:hover{color:var(--text);border-color:var(--border2)}
.subtask.on{color:var(--text);border-color:var(--teal)}
.sbox{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;color:var(--teal);flex:none}
.subtask.on .sbox{background:var(--teal-dim);border-color:var(--teal)}
.macro-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.macro{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.macro-num{font-size:26px;letter-spacing:-.02em}
.macro-lab{color:var(--faint);font-size:11px;letter-spacing:.05em;margin-top:4px}
.row.meal{background:var(--bg2);border:1px solid var(--border);margin-bottom:6px;border-radius:9px}
.meal-time{font-size:11px;color:var(--faint);flex:none;width:54px}
.meal-mac{font-size:11.5px;color:var(--muted);flex:none}
.ta{width:100%;min-height:120px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:13px;color:var(--text);font-family:var(--sans);font-size:13.5px;line-height:1.55;outline:none;resize:vertical}
.ta:focus{border-color:var(--teal)}.ta::placeholder{color:var(--faint)}
.j-actions{display:flex;gap:9px;margin-top:11px;justify-content:flex-end}
.j-row{padding:13px 0;border-bottom:1px solid var(--border)}.j-row:last-child{border:none}
.j-top{display:flex;align-items:center;gap:11px;margin-bottom:6px}
.j-date{font-size:11px;color:var(--faint)}
.link-btn{background:none;border:none;color:var(--teal);font-family:var(--sans);font-size:11.5px;cursor:pointer;padding:0}
.j-sum{font-size:13.5px;line-height:1.5}
.j-raw{margin-top:9px;padding:11px;background:var(--bg3);border-radius:8px;font-size:13px;line-height:1.6;color:var(--muted);white-space:pre-wrap}
.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:11px 18px;border-radius:10px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:50}
@media(max-width:760px){
  .os-sidebar{width:58px;padding:16px 8px}
  .os-navlabel,.brand-name{display:none}
  .grid,.goals-grid,.brain-grid,.macro-row{grid-template-columns:1fr}
  .span2{grid-column:auto}
  .capture-bar{padding:12px 14px}.view-head,.view-body{padding-left:14px;padding-right:14px}
  .cap-btn span{display:none}
}
`}</style>
  );
}
