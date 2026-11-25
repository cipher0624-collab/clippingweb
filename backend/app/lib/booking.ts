export type BookingSettings = {
  businessEmail: string;
  senderEmail: string;
  calendarId: string;
  timeZone: string;
  workingDays: number[];
  startMinutes: number;
  endMinutes: number;
  duration: number;
  buffer: number;
  minNoticeHours: number;
  maxDaysAhead: number;
};

export function settings(): BookingSettings {
  const minuteValue = (value: string | undefined, fallback: string) => {
    const match = (value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    return Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2])));
  };
  return {
    businessEmail: process.env.BOOKING_NOTIFICATION_EMAIL || 'clippigreward@gmail.com',
    senderEmail: process.env.GOOGLE_SENDER_EMAIL || process.env.BOOKING_NOTIFICATION_EMAIL || 'clippigreward@gmail.com',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeZone: process.env.BUSINESS_TIMEZONE || process.env.BOOKING_TIME_ZONE || 'Asia/Kolkata',
    workingDays: (process.env.BUSINESS_DAYS || process.env.BOOKING_WORKING_DAYS || '1,2,3,4,5').split(',').map(v => Number(v.trim())).filter(n => n >= 1 && n <= 7),
    startMinutes: minuteValue(process.env.BUSINESS_START_TIME, '09:00'),
    endMinutes: minuteValue(process.env.BUSINESS_END_TIME, '18:00'),
    duration: Number(process.env.MEETING_DURATION || process.env.BOOKING_DURATION_MINUTES || 30),
    buffer: Number(process.env.BUFFER_TIME || process.env.BOOKING_BUFFER_MINUTES || 15),
    minNoticeHours: Number(process.env.BOOKING_MIN_NOTICE_HOURS || 12),
    maxDaysAhead: Number(process.env.BOOKING_MAX_DAYS_AHEAD || 90),
  };
}

export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export async function googleToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  if (!response.ok) throw new Error('Google authorization failed');
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google authorization returned no access token');
  return data.access_token;
}

export function localDateTime(date: string, time: string, zone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let pass = 0; pass < 2; pass++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utc)).map(part => [part.type, part.value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    utc += Date.UTC(year, month - 1, day, hour, minute) - rendered;
  }
  return new Date(utc);
}

export function dateParts(date: Date, zone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), date: `${p.year}-${p.month}-${p.day}` };
}

export function clockAt(date: Date, zone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function localParts(date: Date, zone: string) {
  return { ...dateParts(date, zone), time: clockAt(date, zone) };
}

export function validTimeZone(zone: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

export async function freeBusy(token: string, start: Date, end: Date, cfg = settings()) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: cfg.timeZone, items: [{ id: cfg.calendarId }] }),
  });
  if (!response.ok) throw new Error('Calendar availability could not be loaded');
  const data = await response.json() as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> };
  return data.calendars?.[cfg.calendarId]?.busy || [];
}

function base64Url(text: string) { return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }

export async function sendBookingEmail(token: string, to: string, subject: string, body: string, cfg = settings()) {
  const raw = [`From: Clipping Rewards <${cfg.senderEmail}>`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', body].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ raw: base64Url(raw) }),
  });
  if (!response.ok) throw new Error('Booking email could not be delivered');
}

export async function createCalendarEvent(token: string, payload: Record<string, unknown>, cfg = settings()) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events?sendUpdates=none`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, cache: 'no-store', body: JSON.stringify(payload),
  });
  if (response.status === 409) throw new Error('BOOKING_SLOT_CONFLICT');
  if (!response.ok) throw new Error('Calendar booking could not be saved');
  return await response.json() as { id: string; htmlLink?: string };
}

export async function deleteCalendarEvent(token: string, eventId: string, cfg = settings()) {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
}
