// Everything in HaydenOS runs on Eastern time so "today" means Hayden's today.
const TZ = "America/New_York";

// "YYYY-MM-DD" for the given instant in Eastern time.
export function todayET(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = f.formatToParts(d);
  const y = p.find((x) => x.type === "year").value;
  const m = p.find((x) => x.type === "month").value;
  const day = p.find((x) => x.type === "day").value;
  return `${y}-${m}-${day}`;
}

export function monthET(d = new Date()) {
  return todayET(d).slice(0, 7);
}

// 0 = Sunday ... 6 = Saturday, for the Eastern calendar date.
export function weekdayET(d = new Date()) {
  return new Date(todayET(d) + "T12:00:00Z").getUTCDay();
}

// Monday (ISO date) of the Eastern week containing the given instant.
export function mondayISO_ET(d = new Date()) {
  const base = new Date(todayET(d) + "T12:00:00Z");
  const off = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - off);
  return base.toISOString().slice(0, 10);
}

// Add n days to a "YYYY-MM-DD" string, returns "YYYY-MM-DD".
export function addDaysISO(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
