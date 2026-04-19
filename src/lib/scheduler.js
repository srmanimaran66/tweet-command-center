// Base schedule slots per tweet order
const BASE_SLOTS = [
  { hour: 12, minute: 15 }, // Tweet 1 — midday peak
  { hour: 15, minute: 10 }, // Tweet 2 — afternoon
  { hour: 17, minute: 40 }, // Tweet 3 — evening drive
];

// Slight per-day variation in minutes to feel natural (Mon–Fri only)
const DAY_OFFSETS = [
  [0, 0],    // Day 1 (Mon) — baseline
  [0, 5],    // Day 2 (Tue) — peak day, slight bump
  [0, -5],   // Day 3 (Wed) — peak day, slightly early
  [0, 10],   // Day 4 (Thu)
  [0, -10],  // Day 5 (Fri) — slightly earlier
];

function applyOffset(base, hourOff, minOff) {
  let totalMin = base.hour * 60 + base.minute + hourOff * 60 + minOff;
  if (totalMin < 0) totalMin += 24 * 60;
  return { hour: Math.floor(totalMin / 60) % 24, minute: totalMin % 60 };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function assignSchedule(tweets, startDate, timeZone = 'America/New_York') {
  return tweets.map(tweet => {
    const dayIndex = (tweet.dayNumber || 1) - 1;
    const orderIndex = (tweet.tweetOrder || 1) - 1;

    const base = BASE_SLOTS[orderIndex] || BASE_SLOTS[0];
    const [hourOff, minOff] = DAY_OFFSETS[dayIndex] || [0, 0];
    const { hour, minute } = applyOffset(base, hourOff, minOff);

    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    date.setHours(hour, minute, 0, 0);

    const displayTime = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`;

    return {
      ...tweet,
      scheduledAt: date.toISOString(),
      displayTime,
      timeZone,
    };
  });
}

export function getDayLabel(dayNumber) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return days[dayNumber - 1] || `Day ${dayNumber}`;
}

export function formatScheduledDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getNextMonday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}
