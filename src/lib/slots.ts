/**
 * Cosmetic slot generation. Slots are client-generated and reserve nothing —
 * the team pre-calls to confirm (see build spec "Out of scope"). Kept as-is,
 * just relocated out of the monolith.
 */

export type SlotType = "today" | "tomorrow" | "week";
export type TimeSlot = { id: string; start: Date; label: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateFR(d: Date) {
  const weekday = d.toLocaleDateString("fr-CA", { weekday: "long" });
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = pad2(d.getFullYear() % 100);
  return `${weekday} ${dd}/${mm}/${yy}`;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function nextBusinessDay(from: Date) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

export function generateTimeSlots(slotType: SlotType, postalRaw: string, now = new Date()): TimeSlot[] {
  const postal = (postalRaw || "").trim().toUpperCase();
  if (postal.length < 3) return [];

  const seed = postal
    .slice(0, 3)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const base = new Date(now);
  base.setHours(12, 0, 0, 0);

  let startDay: Date;
  if (slotType === "today") startDay = nextBusinessDay(base);
  else if (slotType === "tomorrow") {
    const t = nextBusinessDay(base);
    t.setDate(t.getDate() + 1);
    startDay = nextBusinessDay(t);
  } else {
    startDay = nextBusinessDay(base);
  }

  const days: Date[] = [];
  if (slotType === "week") {
    const d = new Date(startDay);
    while (days.length < 5) {
      if (!isWeekend(d)) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
  } else {
    days.push(new Date(startDay));
  }

  const hours = [9, 10, 11, 13, 14, 15, 16];

  const slots: TimeSlot[] = [];
  for (const day of days) {
    for (const h of hours) {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);

      const ampm = h < 12 ? "AM" : "PM";
      const displayH = h <= 12 ? h : h - 12;
      const timeLabel = `${displayH}:00 ${ampm}`;

      slots.push({
        id: `${day.toISOString().slice(0, 10)}-${h}`,
        start,
        label: `${formatDateFR(day)} • ${timeLabel}`,
      });
    }
  }

  const rotateBy = seed % Math.max(1, slots.length);
  const rotated = slots.slice(rotateBy).concat(slots.slice(0, rotateBy));

  if (slotType === "today") return rotated.slice(0, 6);
  if (slotType === "tomorrow") return rotated.slice(0, 8);
  return rotated.slice(0, 12);
}
