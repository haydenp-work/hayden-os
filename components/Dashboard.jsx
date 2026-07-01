"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Home, Calendar, Target, Activity, Wallet, BookOpen,
  Plus, Check, X, Trash2, Loader2, Mic, Camera, Sparkles, Pin, Zap, ChevronRight,
} from "lucide-react";

/* ============================================================
   HaydenOS v2. Built around Hayden: plan and protect the day.
   Home is the command center. State loads from /api/state.
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 10);
const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "goals", label: "Goals", icon: Target },
  { id: "health", label: "Health", icon: Activity },
  { id: "finances", label: "Finances", icon: Wallet },
  { id: "journal", label: "Journal", icon: BookOpen },
];
const START_HOUR = 6, END_HOUR = 22, HOUR_H = 44;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmmToMin = (s) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
function minLabel(min) { const h = Math.floor(min / 60), m = min % 60; const ap = h < 12 ? "AM" : "PM"; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}${m ? ":" + pad(m) : ""} ${ap}`; }

async function mutate(action, payload) {
  try {
    const res = await fetch("/api/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) });
    return await res.json().catch(() => ({}));
  } catch (e) { return {}; }
}
async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return res.json().catch(() => ({}));
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const [meta, data] = String(r.result).split(","); const mediaType = (meta.match(/data:(.*?);/) || [])[1] || "image/png"; resolve({ data, mediaType }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
function startVoice(onText, onState) {
  const Rec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Rec) { onState && onState("unsupported"); return null; }
  const r = new Rec(); r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e) => { onText(e.results[0][0].transcript); onState && onState("idle"); };
  r.onerror = () => onState && onState("idle"); r.onend = () => onState && onState("idle");
  r.start(); onState && onState("listening"); return r;
}

export default function Dashboard() {
  const [os, setOs] = useState(null);
  const [view, setView] = useState("home");
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState(null);

  const [mkText, setMkText] = useState("");
  const [mkReply, setMkReply] = useState("");
  const [mkLoading, setMkLoading] = useState(false);
  const [mkVoice, setMkVoice] = useState("idle");
  const [planning, setPlanning] = useState(false);

  const [dtaskInput, setDtaskInput] = useState("");
  const [wtaskInput, setWtaskInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [goalScope, setGoalScope] = useState("month");
  const [mealText, setMealText] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [jText, setJText] = useState("");
  const [jVoice, setJVoice] = useState("idle");
  const [jSaving, setJSaving] = useState(false);
  const [spentInput, setSpentInput] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");

  const [evTitle, setEvTitle] = useState("");
  const [evDay, setEvDay] = useState("");
  const [evStart, setEvStart] = useState("09:00");
  const [evEnd, setEvEnd] = useState("10:00");

  const [impSpend, setImpSpend] = useState(false);
  const [impSched, setImpSched] = useState(false);
  const spendFileRef = useRef(null);
  const schedFileRef = useRef(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  async function load() {
    const res = await fetch("/api/state");
    if (res.status === 401) { window.location.href = "/login"; return; }
    setOs(await res.json());
  }
  function flash(m) { setToast(m); setTimeout(() => setToast(null), 2600); }
  function patch(fn) { setOs((prev) => { const next = structuredClone(prev); fn(next); return next; }); }

  /* ---------- master key ---------- */
  async function runMaster() {
    const t = mkText.trim(); if (!t) return;
    setMkLoading(true); setMkReply("");
    const r = await post("/api/command", { text: t });
    setMkReply(r.reply || "Done."); setMkText("");
    await load();
    setMkLoading(false);
  }
  function mkMic() {
    if (mkVoice === "listening") return;
    startVoice((txt) => setMkText((p) => (p ? p + " " : "") + txt), setMkVoice);
  }

  /* ---------- plan my day ---------- */
  async function planDay() {
    setPlanning(true);
    const r = await post("/api/plan", {});
    if (r.added && r.added.length) { patch((p) => { p.dailyTasks = [...p.dailyTasks, ...r.added]; }); flash(`Added ${r.added.length} tasks to today.`); }
    else flash("Nothing new to add right now.");
    setPlanning(false);
  }

  /* ---------- daily tasks ---------- */
  async function addDaily(v) { const t = (v ?? dtaskInput).trim(); if (!t) return; const r = await mutate("dtask.add", { title: t }); if (r && r.error) { flash("Could not save: " + r.error); return; } patch((p) => { p.dailyTasks.push({ id: r.id || uid(), title: t, done: false }); }); setDtaskInput(""); }
  function toggleDaily(id, done) { patch((p) => { const x = p.dailyTasks.find((t) => t.id === id); if (x) x.done = done; }); mutate("dtask.toggle", { id, done }); }
  function delDaily(id) { patch((p) => { p.dailyTasks = p.dailyTasks.filter((t) => t.id !== id); }); mutate("dtask.delete", { id }); }
  function delRecurring(id) { patch((p) => { p.recurring = (p.recurring || []).filter((r) => r.id !== id); }); mutate("recurring.delete", { id }); }

  /* ---------- weekly tasks ---------- */
  async function addWeekly() { const t = wtaskInput.trim(); if (!t) return; const r = await mutate("wtask.add", { title: t }); patch((p) => { p.weeklyTasks.push({ id: r.id || uid(), title: t, done: false, pinned: false }); }); setWtaskInput(""); }
  function toggleWeekly(id, done) { patch((p) => { const x = p.weeklyTasks.find((t) => t.id === id); if (x) x.done = done; }); mutate("wtask.toggle", { id, done }); }
  function pinWeekly(id, pinned) { patch((p) => { const x = p.weeklyTasks.find((t) => t.id === id); if (x) x.pinned = pinned; }); mutate("wtask.pin", { id, pinned }); }
  function delWeekly(id) { patch((p) => { p.weeklyTasks = p.weeklyTasks.filter((t) => t.id !== id); }); mutate("wtask.delete", { id }); }

  /* ---------- goals ---------- */
  async function addGoal() { const t = goalInput.trim(); if (!t) return; const r = await mutate("goal.add", { text: t, scope: goalScope }); patch((p) => { p.goals.unshift({ id: r.id || uid(), text: t, scope: goalScope, done: false }); }); setGoalInput(""); }
  function toggleGoal(id, done) { patch((p) => { const x = p.goals.find((g) => g.id === id); if (x) x.done = done; }); mutate("goal.toggle", { id, done }); }
  function delGoal(id) { patch((p) => { p.goals = p.goals.filter((g) => g.id !== id); }); mutate("goal.delete", { id }); }

  /* ---------- events ---------- */
  async function addEvent() {
    const title = evTitle.trim(); if (!title) return;
    const day = evDay || isoLocal(now);
    const s = hhmmToMin(evStart) ?? 540; const e = hhmmToMin(evEnd) ?? s + 60;
    const r = await mutate("event.add", { day, startMin: s, endMin: e, title });
    patch((p) => { p.events.push({ id: r.id || uid(), day, startMin: s, endMin: e, title }); });
    setEvTitle(""); flash("Event added.");
  }
  function delEvent(id) { patch((p) => { p.events = p.events.filter((e) => e.id !== id); }); mutate("event.delete", { id }); }

  /* ---------- meals ---------- */
  async function addMeal() {
    const t = mealText.trim(); if (!t) return; setMealLoading(true);
    const r = await post("/api/meal", { text: t });
    if (r.meal) patch((p) => { p.meals.unshift(r.meal); p.nutrition.calories += r.meal.calories || 0; p.nutrition.protein += r.meal.protein || 0; });
    setMealText(""); setMealLoading(false);
  }

  /* ---------- journal ---------- */
  async function saveJournal() {
    const t = jText.trim(); if (!t) return; setJSaving(true);
    const r = await post("/api/journal", { text: t });
    if (r.entry) patch((p) => { p.journal.unshift(r.entry); });
    setJText(""); setJSaving(false); flash("Reflection saved.");
  }
  function jMic() { if (jVoice === "listening") return; startVoice((txt) => setJText((p) => (p ? p + " " : "") + txt), setJVoice); }

  /* ---------- spend / nutrition settings ---------- */
  function setSpend(a) { const v = Number(a) || 0; patch((p) => { p.spend.spent = v; }); mutate("spend.set", { amount: v }); flash("Spend updated."); }
  function setLimit(a) { const v = Number(a) || 0; patch((p) => { p.spend.limit = v; }); mutate("spend.limit", { amount: v }); flash("Limit updated."); }
  function setProteinGoal(a) { const v = Number(a) || 200; patch((p) => { p.nutrition.proteinGoal = v; }); mutate("protein.goal", { grams: v }); flash("Protein goal updated."); }

  /* ---------- imports ---------- */
  async function importSpendShot(file) {
    if (!file) return; setImpSpend(true);
    try { const { data, mediaType } = await fileToBase64(file); const r = await post("/api/import", { type: "spend", image: data, mediaType });
      if (r && typeof r.newTotal === "number") { patch((p) => { p.spend.spent = r.newTotal; }); flash(`Added $${r.added.toLocaleString()}. Month total $${r.newTotal.toLocaleString()}.`); }
      else flash("Could not read that statement.");
    } catch (e) { flash("Import failed."); }
    setImpSpend(false); if (spendFileRef.current) spendFileRef.current.value = "";
  }
  async function importSchedShot(file) {
    if (!file) return; setImpSched(true);
    try { const { data, mediaType } = await fileToBase64(file); const r = await post("/api/import", { type: "schedule", image: data, mediaType });
      if (r && Array.isArray(r.events) && r.events.length) { await load(); flash(`Added ${r.events.length} events to your week.`); }
      else flash("Could not read that schedule.");
    } catch (e) { flash("Import failed."); }
    setImpSched(false); if (schedFileRef.current) schedFileRef.current.value = "";
  }

  if (!os) {
    return (<div className="os boot"><Loader2 size={20} className="spin" /><span>Loading your dashboard...</span><Style /></div>);
  }

  const monday = new Date(os.week + "T00:00:00");
  const days = [...Array(7)].map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  const VIEWS = { home: renderHome, schedule: renderSchedule, goals: renderGoals, health: renderHealth, finances: renderFinances, journal: renderJournal };

  /* ===================== HOME ===================== */
  function renderHome() {
    const hour = now.getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const pinned = os.weeklyTasks.filter((t) => t.pinned && !t.done);
    const nut = os.nutrition;
    const pPct = nut.proteinGoal ? Math.min(100, Math.round((nut.protein / nut.proteinGoal) * 100)) : 0;

    return (
      <div className="home">
        <div className="view-head"><h1>{greet}, <span className="g-name">Hayden</span></h1><div className="sess-date">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div></div>

        {/* MASTER KEY */}
        <div className="panel mk-panel">
          <div className="plabel"><Sparkles size={13} /> MASTER KEY <span className="pcount mono">command + advice</span></div>
          <div className="mk-row">
            <textarea className="mk-input" rows={2} placeholder="Ask for advice, or tell me what to do. Add a task, put Duke visit Thursday at 2, remind me every Friday to send my schedule..." value={mkText} onChange={(e) => setMkText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runMaster(); } }} />
            <div className="mk-actions">
              <button className={mkVoice === "listening" ? "cap-mic rec" : "cap-mic"} onClick={mkMic} title="Voice"><Mic size={16} /></button>
              <button className="cap-go" onClick={runMaster} disabled={mkLoading}>{mkLoading ? <Loader2 size={14} className="spin" /> : <>Run <ChevronRight size={13} /></>}</button>
            </div>
          </div>
          {mkReply && <div className="mk-reply">{mkReply}</div>}
        </div>

        {/* TODAY + right rail */}
        <div className="home-row">
          <div className="panel">
            <div className="plabel"><Zap size={13} /> TODAY
              <button className="ghost-btn plan" onClick={planDay} disabled={planning}>{planning ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />} Plan my day</button>
            </div>
            <div className="list">
              {pinned.map((t) => (
                <div key={t.id} className="row">
                  <button className="check" onClick={() => toggleWeekly(t.id, true)}><Check size={13} /></button>
                  <span className="row-title">{t.title}</span>
                  <span className="tag-pin"><Pin size={11} /> weekly</span>
                </div>
              ))}
              {os.dailyTasks.map((t) => (
                <div key={t.id} className="row">
                  <button className={t.done ? "check on" : "check"} onClick={() => toggleDaily(t.id, !t.done)}>{t.done && <Check size={13} />}</button>
                  <span className={t.done ? "row-title strike" : "row-title"}>{t.title}</span>
                  <button className="icon-btn faint" onClick={() => delDaily(t.id)}><X size={13} /></button>
                </div>
              ))}
              {pinned.length === 0 && os.dailyTasks.length === 0 && <div className="empty">Nothing yet. Pin a weekly task or hit Plan my day.</div>}
            </div>
            <div className="cap" style={{ marginTop: 12 }}>
              <input className="cap-inp" placeholder="Add a task for today" value={dtaskInput} onChange={(e) => setDtaskInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDaily(); }} />
              <button className="cap-go" onClick={() => addDaily()}><Plus size={15} /></button>
            </div>
            {(os.recurring || []).length > 0 && (
              <div className="repeating">
                <div className="rep-label">Repeating</div>
                {os.recurring.map((r) => (
                  <div key={r.id} className="rep-row">
                    <span className="rep-day mono">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.weekday]}</span>
                    <span className="rep-title">{r.title}</span>
                    <button className="icon-btn faint" onClick={() => delRecurring(r.id)}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stack">
            <div className="panel nut-panel">
              <div className="plabel"><Activity size={13} /> NUTRITION</div>
              <div className="nut-ring-wrap">
                <div className="ring-holder"><Ring pct={pPct} /><div className="ring-center"><div className="ring-pct mono">{pPct}%</div><div className="ring-cap">protein</div></div></div>
                <div className="nut-figs">
                  <div className="nut-line"><span className="mono big">{nut.protein}</span><span className="nut-unit">/ {nut.proteinGoal} g protein</span></div>
                  <div className="nut-line"><span className="mono big">{nut.calories}</span><span className="nut-unit">kcal today</span></div>
                </div>
              </div>
            </div>
            <SpendPanel spend={os.spend} />
          </div>
        </div>

        {/* WEEK CALENDAR (largest) */}
        <div className="panel cal-panel">
          <div className="plabel"><Calendar size={13} /> THIS WEEK <span className="pcount mono">{monday.toLocaleDateString([], { month: "short", day: "numeric" })} - {days[6].toLocaleDateString([], { month: "short", day: "numeric" })}</span></div>
          <WeekCalendar days={days} events={os.events} now={now} onDelete={delEvent} />
          <EventForm days={days} evTitle={evTitle} setEvTitle={setEvTitle} evDay={evDay} setEvDay={setEvDay} evStart={evStart} setEvStart={setEvStart} evEnd={evEnd} setEvEnd={setEvEnd} onAdd={addEvent} defaultDay={isoLocal(now)} />
        </div>

        {/* WEEKLY TASKS + MONTHLY GOALS */}
        <div className="home-row2">
          <div className="panel">
            <div className="plabel"><Check size={13} /> WEEKLY TASKS</div>
            <div className="list">
              {os.weeklyTasks.map((t) => (
                <div key={t.id} className="row">
                  <button className={t.done ? "check on" : "check"} onClick={() => toggleWeekly(t.id, !t.done)}>{t.done && <Check size={13} />}</button>
                  <span className={t.done ? "row-title strike" : "row-title"}>{t.title}</span>
                  <button className={t.pinned ? "pin-btn on" : "pin-btn"} title="Pin to today" onClick={() => pinWeekly(t.id, !t.pinned)}><Pin size={13} /></button>
                  <button className="icon-btn faint" onClick={() => delWeekly(t.id)}><X size={13} /></button>
                </div>
              ))}
              {os.weeklyTasks.length === 0 && <div className="empty">Add the things you want done this week.</div>}
            </div>
            <div className="cap" style={{ marginTop: 12 }}>
              <input className="cap-inp" placeholder="Add a weekly task" value={wtaskInput} onChange={(e) => setWtaskInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWeekly(); }} />
              <button className="cap-go" onClick={addWeekly}><Plus size={15} /></button>
            </div>
          </div>

          <div className="panel">
            <div className="plabel"><Target size={13} /> MONTHLY GOALS</div>
            <GoalList goals={os.goals.filter((g) => g.scope === "month")} onToggle={toggleGoal} onDelete={delGoal} empty="Set your goals for the month." />
            <div className="cap" style={{ marginTop: 12 }}>
              <input className="cap-inp" placeholder="Add a monthly goal" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setGoalScope("month"); addGoal(); } }} />
              <button className="cap-go" onClick={() => { setGoalScope("month"); addGoal(); }}><Plus size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===================== SCHEDULE ===================== */
  function renderSchedule() {
    return (
      <div style={{ maxWidth: 1200 }}>
        <div className="view-head"><h1>Schedule</h1></div>
        <div className="panel">
          <div className="plabel"><Calendar size={13} /> WEEK OF {monday.toLocaleDateString([], { month: "short", day: "numeric" })}
            <input ref={schedFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => importSchedShot(e.target.files && e.target.files[0])} />
            <button className="ghost-btn plan" onClick={() => schedFileRef.current && schedFileRef.current.click()} disabled={impSched}>{impSched ? <Loader2 size={12} className="spin" /> : <Camera size={12} />} Import screenshot</button>
          </div>
          <WeekCalendar days={days} events={os.events} now={now} onDelete={delEvent} tall />
          <EventForm days={days} evTitle={evTitle} setEvTitle={setEvTitle} evDay={evDay} setEvDay={setEvDay} evStart={evStart} setEvStart={setEvStart} evEnd={evEnd} setEvEnd={setEvEnd} onAdd={addEvent} defaultDay={isoLocal(now)} />
        </div>
      </div>
    );
  }

  /* ===================== GOALS ===================== */
  function renderGoals() {
    return (
      <div style={{ maxWidth: 720 }}>
        <div className="view-head"><h1>Goals</h1></div>
        <div className="panel">
          <div className="plabel"><Target size={13} /> THIS MONTH</div>
          <GoalList goals={os.goals.filter((g) => g.scope === "month")} onToggle={toggleGoal} onDelete={delGoal} empty="No monthly goals yet." />
          <div className="cap" style={{ marginTop: 12 }}>
            <input className="cap-inp" placeholder="Add a monthly goal" value={goalScope === "month" ? goalInput : ""} onFocus={() => setGoalScope("month")} onChange={(e) => setGoalInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setGoalScope("month"); addGoal(); } }} />
            <button className="cap-go" onClick={() => { setGoalScope("month"); addGoal(); }}><Plus size={15} /></button>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="plabel"><Check size={13} /> THIS WEEK</div>
          <GoalList goals={os.goals.filter((g) => g.scope === "week")} onToggle={toggleGoal} onDelete={delGoal} empty="No weekly goals yet." />
          <div className="cap" style={{ marginTop: 12 }}>
            <input className="cap-inp" placeholder="Add a weekly goal" value={goalScope === "week" ? goalInput : ""} onFocus={() => setGoalScope("week")} onChange={(e) => setGoalInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setGoalScope("week"); addGoal(); } }} />
            <button className="cap-go" onClick={() => { setGoalScope("week"); addGoal(); }}><Plus size={15} /></button>
          </div>
        </div>
      </div>
    );
  }

  /* ===================== HEALTH ===================== */
  function renderHealth() {
    const nut = os.nutrition;
    const pPct = nut.proteinGoal ? Math.min(100, Math.round((nut.protein / nut.proteinGoal) * 100)) : 0;
    return (
      <div style={{ maxWidth: 720 }}>
        <div className="view-head"><h1>Health</h1></div>
        <div className="panel">
          <div className="plabel"><Activity size={13} /> TODAY</div>
          <div className="nut-ring-wrap big">
            <div className="ring-holder"><Ring pct={pPct} size={120} stroke={11} /><div className="ring-center"><div className="ring-pct mono">{pPct}%</div><div className="ring-cap">of {nut.proteinGoal}g</div></div></div>
            <div className="nut-figs">
              <div className="nut-line"><span className="mono big">{nut.protein}</span><span className="nut-unit">/ {nut.proteinGoal} g protein</span></div>
              <div className="nut-line"><span className="mono big">{nut.calories}</span><span className="nut-unit">kcal</span></div>
              <div className="sub-label" style={{ margin: "14px 0 6px" }}>Daily protein goal</div>
              <div className="note-add">
                <input className="inp" inputMode="numeric" style={{ maxWidth: 110 }} placeholder={`${nut.proteinGoal}`} value={proteinInput} onChange={(e) => setProteinInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setProteinGoal(proteinInput); setProteinInput(""); } }} />
                <button className="ghost-btn" onClick={() => { setProteinGoal(proteinInput); setProteinInput(""); }}>Set goal</button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="plabel"><Plus size={13} /> LOG A MEAL <span className="pcount mono">claude estimates macros</span></div>
          <div className="cap">
            <input className="cap-inp" placeholder="e.g. grilled chicken bowl with rice and beans" value={mealText} onChange={(e) => setMealText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMeal(); }} />
            <button className="cap-go" onClick={addMeal} disabled={mealLoading}>{mealLoading ? <Loader2 size={14} className="spin" /> : <Plus size={15} />}</button>
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {os.meals.map((m) => (
              <div key={m.id} className="row">
                <span className="row-title">{m.name}</span>
                <span className="mono meal-macro">{m.protein}g P</span>
                <span className="mono meal-macro faint">{m.calories} kcal</span>
              </div>
            ))}
            {os.meals.length === 0 && <div className="empty">No meals logged today.</div>}
          </div>
        </div>
      </div>
    );
  }

  /* ===================== FINANCES ===================== */
  function renderFinances() {
    const { spent, limit } = os.spend;
    const remaining = limit - spent;
    const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
    const over = pct >= 100, warn = pct >= 85;
    const bar = over ? "#e2544f" : warn ? "var(--gold)" : "var(--accent)";
    return (
      <div style={{ maxWidth: 640 }}>
        <div className="view-head"><h1>Finances</h1></div>
        <div className="panel">
          <div className="plabel"><Wallet size={13} /> MONTHLY SPEND <span className="pcount mono">{os.spend.month}</span></div>
          <div className="net big mono" style={{ color: bar }}>${spent.toLocaleString()}</div>
          <div className="net-label">of ${limit.toLocaleString()} limit</div>
          <div className="spend-bar"><span style={{ width: pct + "%", background: bar }} /></div>
          <div className="spend-foot mono"><span style={{ color: bar }}>{Math.round(pct)}% used</span><span>{remaining >= 0 ? `$${remaining.toLocaleString()} left` : `$${Math.abs(remaining).toLocaleString()} over`}</span></div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="plabel"><Plus size={13} /> UPDATE</div>
          <input ref={spendFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => importSpendShot(e.target.files && e.target.files[0])} />
          <button className="solid-btn wide" style={{ marginBottom: 14 }} onClick={() => spendFileRef.current && spendFileRef.current.click()} disabled={impSpend}>{impSpend ? <Loader2 size={14} className="spin" /> : <Camera size={14} />} Import statement screenshot</button>
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
      </div>
    );
  }

  /* ===================== JOURNAL ===================== */
  function renderJournal() {
    return (
      <div style={{ maxWidth: 720 }}>
        <div className="view-head"><h1>Journal</h1></div>
        <div className="panel">
          <div className="plabel"><BookOpen size={13} /> TONIGHT'S REFLECTION <span className="pcount mono">feeds your advice</span></div>
          <textarea className="mk-input" rows={4} placeholder="How did today go? What worked, what slipped, what is on your mind for tomorrow?" value={jText} onChange={(e) => setJText(e.target.value)} />
          <div className="cap" style={{ marginTop: 10 }}>
            <button className={jVoice === "listening" ? "cap-mic rec" : "cap-mic"} onClick={jMic}><Mic size={16} /></button>
            <button className="cap-go" onClick={saveJournal} disabled={jSaving} style={{ marginLeft: "auto" }}>{jSaving ? <Loader2 size={14} className="spin" /> : "Save reflection"}</button>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="plabel"><ChevronRight size={13} /> PAST ENTRIES</div>
          <div className="jlist">
            {os.journal.map((j) => (
              <div key={j.id} className="jentry">
                <div className="jdate mono">{j.date}</div>
                {j.summary && <div className="jsum">{j.summary}</div>}
                <div className="jbody">{j.text}</div>
              </div>
            ))}
            {os.journal.length === 0 && <div className="empty">Your reflections will show up here.</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="os">
      <div className="topbar">
        <div className="brand"><div className="brand-mark" /><span className="brand-name">HAYDEN<span style={{ color: "var(--accent)" }}>OS</span></span></div>
        <div className="topnav">
          {TABS.map((t) => { const I = t.icon; return (<button key={t.id} className={view === t.id ? "tab on" : "tab"} onClick={() => setView(t.id)}><I size={13} style={{ marginRight: 6, verticalAlign: "-2px" }} />{t.label}</button>); })}
        </div>
        <div className="topstat"><span className="ts-time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="ts-live"><span className="dot" /> live</span></div>
      </div>
      <div className="os-main">{VIEWS[view]()}</div>
      {toast && <div className="toast">{toast}</div>}
      <Style />
    </div>
  );
}

/* ===================== SUBCOMPONENTS ===================== */
function Ring({ pct, size = 92, stroke = 9, color = "var(--accent)" }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, (pct || 0) / 100));
  return (
    <svg width={size} height={size} className="ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s ease" }} />
    </svg>
  );
}

function SpendPanel({ spend }) {
  const { spent, limit } = spend;
  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = pct >= 100, warn = pct >= 85;
  const bar = over ? "#e2544f" : warn ? "var(--gold)" : "var(--accent)";
  const remaining = limit - spent;
  return (
    <div className="panel">
      <div className="plabel"><Wallet size={13} /> SPEND <span className="pcount mono">MONTH</span></div>
      <div className="net mono" style={{ color: bar }}>${spent.toLocaleString()}</div>
      <div className="net-label">of ${limit.toLocaleString()}</div>
      <div className="spend-bar"><span style={{ width: pct + "%", background: bar }} /></div>
      <div className="spend-foot mono"><span style={{ color: bar }}>{Math.round(pct)}%</span><span>{remaining >= 0 ? `$${remaining.toLocaleString()} left` : `$${Math.abs(remaining).toLocaleString()} over`}</span></div>
    </div>
  );
}

function GoalList({ goals, onToggle, onDelete, empty }) {
  return (
    <div className="list">
      {goals.map((g) => (
        <div key={g.id} className="row">
          <button className={g.done ? "check on" : "check"} onClick={() => onToggle(g.id, !g.done)}>{g.done && <Check size={13} />}</button>
          <span className={g.done ? "row-title strike" : "row-title"}>{g.text}</span>
          <button className="icon-btn faint" onClick={() => onDelete(g.id)}><Trash2 size={12} /></button>
        </div>
      ))}
      {goals.length === 0 && <div className="empty">{empty}</div>}
    </div>
  );
}

function EventForm({ days, evTitle, setEvTitle, evDay, setEvDay, evStart, setEvStart, evEnd, setEvEnd, onAdd, defaultDay }) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const dayVal = evDay || defaultDay;
  return (
    <div className="ev-form">
      <input className="inp ev-title" placeholder="New event" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }} />
      <select className="inp ev-sel" value={dayVal} onChange={(e) => setEvDay(e.target.value)}>
        {days.map((d) => { const v = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; return <option key={v} value={v}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} {d.getDate()}</option>; })}
      </select>
      <input className="inp ev-time" type="time" value={evStart} onChange={(e) => setEvStart(e.target.value)} />
      <span className="ev-dash">to</span>
      <input className="inp ev-time" type="time" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} />
      <button className="solid-btn" onClick={onAdd}><Plus size={14} /></button>
    </div>
  );
}

function WeekCalendar({ days, events, now, onDelete, tall }) {
  const h = (END_HOUR - START_HOUR) * HOUR_H;
  const hours = [...Array(END_HOUR - START_HOUR + 1)].map((_, i) => START_HOUR + i);
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayIso = isoOf(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_H;
  return (
    <div className={tall ? "cal tall" : "cal"}>
      <div className="cal-days">
        <div className="cal-gh" />
        {days.map((d, i) => (<div key={i} className={isoOf(d) === todayIso ? "cal-dh on" : "cal-dh"}><span className="cal-dow">{DOW[d.getDay()]}</span><span className="cal-dn mono">{d.getDate()}</span></div>))}
      </div>
      <div className="cal-body" style={{ height: h }}>
        <div className="cal-gutter">
          {hours.map((hr) => (<div key={hr} className="cal-hr" style={{ height: HOUR_H }}><span>{minLabel(hr * 60)}</span></div>))}
        </div>
        <div className="cal-cols">
          {days.map((d, i) => {
            const dayIso = isoOf(d);
            const evs = events.filter((e) => e.day === dayIso);
            return (
              <div key={i} className="cal-col">
                {hours.slice(0, -1).map((hr) => <div key={hr} className="cal-slot" style={{ height: HOUR_H }} />)}
                {dayIso === todayIso && nowTop >= 0 && nowTop <= h && <div className="cal-now" style={{ top: nowTop }} />}
                {evs.map((e) => {
                  const top = Math.max(0, ((e.startMin - START_HOUR * 60) / 60) * HOUR_H);
                  const height = Math.max(18, ((e.endMin - e.startMin) / 60) * HOUR_H - 2);
                  return (
                    <button key={e.id} className="cal-ev" style={{ top, height }} onClick={() => onDelete(e.id)} title="Tap to delete">
                      <span className="cal-ev-t mono">{minLabel(e.startMin)}</span>
                      <span className="cal-ev-title">{e.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Style() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#05080d; --bg2:#0a0f16; --bg3:#10161f; --line:#182029; --line2:#232d38;
  --text:#e6ecf2; --muted:#7b8794; --faint:#4b5563;
  --accent:#35d6be; --accent2:#2bb89f; --gold:#d9b46a; --blue:#5a93d4;
  --accent-dim:rgba(53,214,190,.12); --accent-dim2:rgba(53,214,190,.06);
  --sans:'Inter',system-ui,sans-serif; --serif:'Newsreader',Georgia,serif; --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}
.os{min-height:100vh;background:radial-gradient(1200px 600px at 70% -10%,rgba(53,214,190,.05),transparent),var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;display:flex;flex-direction:column}
.os .mono{font-family:var(--mono)} .os .faint{color:var(--faint)}
.os.boot{align-items:center;justify-content:center;flex-direction:row;gap:12px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

.topbar{display:flex;align-items:center;gap:22px;padding:0 22px;height:52px;background:rgba(8,12,18,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.brand{display:flex;align-items:center;gap:8px;flex:none}
.brand-mark{width:11px;height:11px;border-radius:3px;background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 0 12px var(--accent-dim)}
.brand-name{font-family:var(--mono);font-weight:500;font-size:13px;letter-spacing:.14em}
.topnav{display:flex;gap:2px;flex:1;overflow-x:auto}
.tab{background:none;border:none;color:var(--muted);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:.15s}
.tab:hover{color:var(--text)}
.tab.on{color:var(--text);background:var(--accent-dim);box-shadow:inset 0 -2px 0 var(--accent)}
.topstat{display:flex;align-items:center;gap:14px;flex:none;font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--muted)}
.ts-time{color:var(--text)} .ts-live{display:flex;align-items:center;gap:6px;color:var(--accent)}
.ts-live .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent)}

.os-main{flex:1;min-width:0;padding:18px 22px 48px;max-width:1400px;width:100%;margin:0 auto}
.view-head{padding:2px 2px 16px}
.view-head h1{margin:0;font-family:var(--serif);font-weight:500;font-size:27px;letter-spacing:-.01em}
.g-name{font-style:italic}
.sess-date{color:var(--muted);font-size:12.5px;margin-top:4px}

.panel{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px}
.plabel{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.plabel svg{color:var(--accent)}
.pcount{margin-left:auto;color:var(--faint);letter-spacing:.08em}
.empty{color:var(--faint);font-size:13px;padding:8px 2px;line-height:1.5}
.sub-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:14px 0 8px;font-family:var(--mono)}

/* home layout */
.home{display:flex;flex-direction:column;gap:14px}
.home-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:14px;align-items:start}
.home-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.stack{display:flex;flex-direction:column;gap:14px}
@media(max-width:920px){.home-row,.home-row2{grid-template-columns:1fr}}

/* master key */
.mk-panel{background:radial-gradient(600px 200px at 100% -40%,var(--accent-dim2),transparent),var(--bg2)}
.mk-row{display:flex;gap:10px;align-items:stretch}
.mk-input{flex:1;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:12px 13px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;resize:vertical;min-height:52px;line-height:1.5}
.mk-input:focus{border-color:var(--accent)} .mk-input::placeholder{color:var(--faint)}
.mk-actions{display:flex;flex-direction:column;gap:8px;justify-content:flex-start}
.mk-reply{margin-top:12px;padding:12px 14px;background:var(--accent-dim2);border:1px solid var(--line);border-left:2px solid var(--accent);border-radius:8px;font-size:14px;line-height:1.55;color:var(--text)}

/* buttons */
.cap{display:flex;gap:8px}
.cap-inp{flex:1;background:var(--bg3);border:1px solid var(--line);border-radius:9px;padding:11px 13px;color:var(--text);font-family:var(--sans);font-size:13.5px;outline:none;min-width:0;transition:.15s}
.cap-inp:focus{border-color:var(--accent)} .cap-inp::placeholder{color:var(--faint)}
.cap-mic{flex:none;width:40px;border-radius:9px;background:var(--bg3);border:1px solid var(--line);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.cap-mic:hover{color:var(--text)} .cap-mic.rec{color:var(--accent);border-color:var(--accent)}
.cap-go{flex:none;background:var(--accent);color:#04201c;border:none;border-radius:9px;padding:0 15px;min-height:40px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;justify-content:center;transition:.15s}
.cap-go:hover{filter:brightness(1.08)} .cap-go:disabled{opacity:.6}
.ghost-btn{margin-left:auto;background:var(--bg3);border:1px solid var(--line);color:var(--muted);border-radius:7px;padding:5px 10px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:5px;transition:.15s}
.ghost-btn:hover{color:var(--text);border-color:var(--line2)} .ghost-btn.plan{color:var(--accent)}
.solid-btn{background:var(--accent);color:#04201c;border:none;border-radius:8px;padding:9px 14px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;justify-content:center;transition:.15s}
.solid-btn:hover{filter:brightness(1.08)} .solid-btn.wide{width:100%}
.icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:4px;border-radius:6px;transition:.12s}
.icon-btn:hover{color:#e2544f;background:var(--bg3)} .icon-btn.faint{color:var(--faint)}
.inp{background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:9px 11px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none}
.inp:focus{border-color:var(--accent)}
.note-add{display:flex;gap:8px;align-items:center}

/* rows */
.list{display:flex;flex-direction:column;gap:2px}
.row{display:flex;align-items:center;gap:10px;padding:9px 6px;border-radius:8px;transition:.12s}
.row:hover{background:var(--bg3)}
.row-title{flex:1;font-size:13.5px;line-height:1.4;min-width:0}
.strike{color:var(--faint);text-decoration:line-through}
.check{flex:none;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line2);background:none;color:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.check:hover{border-color:var(--accent);color:var(--accent)} .check.on{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
.pin-btn{flex:none;background:none;border:none;color:var(--faint);cursor:pointer;display:flex;padding:3px;border-radius:6px;transition:.12s}
.pin-btn:hover{color:var(--muted)} .pin-btn.on{color:var(--gold)}
.tag-pin{display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);flex:none}

/* nutrition */
.nut-ring-wrap{display:flex;align-items:center;gap:16px}
.nut-ring-wrap.big{gap:22px}
.ring-holder{position:relative;flex:none;display:flex;align-items:center;justify-content:center}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring-pct{font-size:19px;color:var(--text)} .ring-cap{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);font-family:var(--mono)}
.nut-figs{display:flex;flex-direction:column;gap:8px;min-width:0}
.nut-line{display:flex;align-items:baseline;gap:7px}
.nut-line .big{font-size:24px;letter-spacing:-.02em;color:var(--text)}
.nut-unit{font-size:12px;color:var(--muted)}
.meal-macro{font-size:11.5px;color:var(--muted);flex:none}

/* finance */
.net{font-family:var(--mono);font-size:27px;letter-spacing:-.02em} .net.big{font-size:38px}
.net-label{color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin:2px 0 10px;font-family:var(--mono)}
.spend-bar{height:8px;border-radius:5px;background:var(--bg3);overflow:hidden;margin:4px 0 10px}
.spend-bar span{display:block;height:100%;border-radius:5px;transition:width .4s ease}
.spend-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);letter-spacing:.04em}

/* calendar */
.cal{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg)}
.cal-days{display:grid;grid-template-columns:52px repeat(7,1fr);border-bottom:1px solid var(--line)}
.cal-gh{border-right:1px solid var(--line)}
.cal-dh{display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 0;border-right:1px solid var(--line)}
.cal-dh:last-child{border-right:none}
.cal-dh.on{background:var(--accent-dim)}
.cal-dow{font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--faint)}
.cal-dh.on .cal-dow{color:var(--accent)}
.cal-dn{font-size:14px}
.cal-body{display:grid;grid-template-columns:52px 1fr;overflow-y:auto}
.cal.tall .cal-body{max-height:none}
.cal-gutter{border-right:1px solid var(--line)}
.cal-hr{position:relative;border-bottom:1px dashed transparent}
.cal-hr span{position:absolute;top:-7px;right:6px;font-family:var(--mono);font-size:9px;color:var(--faint)}
.cal-cols{display:grid;grid-template-columns:repeat(7,1fr);position:relative}
.cal-col{position:relative;border-right:1px solid var(--line)}
.cal-col:last-child{border-right:none}
.cal-slot{border-bottom:1px solid var(--line)}
.cal-now{position:absolute;left:0;right:0;height:2px;background:#e2544f;z-index:3;box-shadow:0 0 6px rgba(226,84,79,.6)}
.cal-ev{position:absolute;left:3px;right:3px;background:var(--accent-dim);border:1px solid var(--accent);border-left:3px solid var(--accent);border-radius:6px;padding:3px 6px;text-align:left;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:1px;z-index:2;transition:.12s}
.cal-ev:hover{background:rgba(53,214,190,.2)}
.cal-ev-t{font-size:8.5px;color:var(--accent);letter-spacing:.02em}
.cal-ev-title{font-size:11px;color:var(--text);line-height:1.15;overflow:hidden;text-overflow:ellipsis}

/* event form */
.ev-form{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
.ev-title{flex:1;min-width:140px}
.ev-sel{min-width:88px} .ev-time{width:118px}
.ev-dash{color:var(--faint);font-size:12px}

/* journal */
.jlist{display:flex;flex-direction:column;gap:10px}
.jentry{background:var(--bg3);border:1px solid var(--line);border-radius:9px;padding:12px 13px}
.jdate{font-size:10px;letter-spacing:.1em;color:var(--accent);margin-bottom:5px}
.jsum{font-size:13px;color:var(--muted);font-style:italic;margin-bottom:6px;line-height:1.5}
.jbody{font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap}

/* repeating reminders */
.repeating{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.rep-label{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
.rep-row{display:flex;align-items:center;gap:9px;padding:5px 4px;border-radius:7px}
.rep-row:hover{background:var(--bg3)}
.rep-day{font-size:10px;color:var(--gold);flex:none;width:30px;letter-spacing:.06em}
.rep-title{flex:1;font-size:12.5px;color:var(--muted);min-width:0}

/* toast */
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--bg3);border:1px solid var(--accent);color:var(--text);padding:10px 18px;border-radius:9px;font-size:13px;z-index:50;box-shadow:0 8px 30px rgba(0,0,0,.5)}
`}</style>
  );
}
