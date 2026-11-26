import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { calendarConfigured, clockAt, createCalendarEvent, dateParts, deleteCalendarEvent, freeBusy, googleToken, localDateTime, sendBookingEmail, settings, validTimeZone } from '../../lib/booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const activeSlots = new Set<string>();
const types = new Set(['Podcast', 'YouTube', 'Interview', 'Livestream', 'Music', 'Personal Brand', 'Other']);
const services = new Set(['Short-form editing', 'Content repurposing', 'Clipping campaign', 'Distribution', 'Full short-form solution', 'Not sure yet']);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(request: NextRequest) {
  const cfg = settings();
  if (!calendarConfigured()) return NextResponse.json({ error: `Online booking is unavailable right now. Please email ${cfg.businessEmail} and we’ll help you schedule.` }, { status: 503 });
  let data: Record<string, unknown>;
  try { data = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Please check the booking form and try again.' }, { status: 400 }); }
  if (clean(data.websiteTrap, 200)) return NextResponse.json({ ok: true });
  const name = clean(data.name, 120); const email = clean(data.email, 254).toLowerCase();
  const company = clean(data.company, 160); const contentType = clean(data.contentType, 50);
  const profile = clean(data.profile, 500); const service = clean(data.service, 80); const message = clean(data.message, 3000);
  const startText = clean(data.startAt, 40); const visitorTimeZone = clean(data.visitorTimeZone, 100);
  const startAt = new Date(startText);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !company || !types.has(contentType) || !services.has(service) || !startText || !Number.isFinite(startAt.getTime()) || startAt.toISOString() !== startText || !validTimeZone(visitorTimeZone)) {
    return NextResponse.json({ error: 'Please complete each required field and choose a valid time.' }, { status: 400 });
  }
  const businessSlot = dateParts(startAt, cfg.timeZone);
  const date = businessSlot.date; const time = clockAt(startAt, cfg.timeZone);
  const lock = startAt.toISOString();
  if (activeSlots.has(lock)) return NextResponse.json({ error: 'That time is being booked right now. Please choose another.' }, { status: 409 });
  activeSlots.add(lock);
  let token = '';
  let eventId = '';
  try {
    token = await googleToken();
    const validatedStart = localDateTime(date, time, cfg.timeZone);
    if (validatedStart.toISOString() !== startAt.toISOString()) return NextResponse.json({ error: 'That time is not a valid available appointment. Please choose another.' }, { status: 400 });
    const endAt = new Date(startAt.getTime() + cfg.duration * 60000);
    const now = new Date(); const max = new Date(now.getTime() + cfg.maxDaysAhead * 86400000);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    const minuteOfDay = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const validStep = (minuteOfDay - cfg.startMinutes) % (cfg.duration + cfg.buffer) === 0;
    if (!cfg.workingDays.includes(weekday) || !validStep || minuteOfDay < cfg.startMinutes || minuteOfDay + cfg.duration > cfg.endMinutes || startAt < new Date(now.getTime() + cfg.minNoticeHours * 3600000) || startAt > max) {
      return NextResponse.json({ error: 'That time is outside the current booking schedule. Please choose another.' }, { status: 400 });
    }
    const busy = await freeBusy(token, new Date(startAt.getTime() - cfg.buffer * 60000), new Date(endAt.getTime() + cfg.buffer * 60000), cfg);
    const paddedStart = new Date(startAt.getTime() - cfg.buffer * 60000);
    const paddedEnd = new Date(endAt.getTime() + cfg.buffer * 60000);
    if (busy.some(item => paddedStart < new Date(item.end) && paddedEnd > new Date(item.start))) return NextResponse.json({ error: 'That time was just taken. Please choose another available time.' }, { status: 409 });
    const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: cfg.timeZone, dateStyle: 'full' }).format(startAt);
    const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone: cfg.timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(startAt);
    const visitorDateLabel = new Intl.DateTimeFormat('en-US', { timeZone: visitorTimeZone, dateStyle: 'full' }).format(startAt);
    const visitorTimeLabel = new Intl.DateTimeFormat('en-US', { timeZone: visitorTimeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(startAt);
    const event = await createCalendarEvent(token, {
      id: `cr${createHash('sha256').update(`${cfg.calendarId}|${startAt.toISOString()}`).digest('hex').slice(0, 40)}`,
      summary: `Clipping Rewards consultation — ${name}`,
      description: [`Client: ${name}`, `Email: ${email}`, `Company / Brand: ${company}`, `Content Type: ${contentType}`, `Website / Social: ${profile || 'Not provided'}`, `Requested Service: ${service}`, `Additional Information: ${message || 'None'}`].join('\n'),
      start: { dateTime: startAt.toISOString(), timeZone: cfg.timeZone }, end: { dateTime: endAt.toISOString(), timeZone: cfg.timeZone },
      attendees: [{ email }, { email: cfg.businessEmail }],
    }, cfg);
    eventId = event.id;
    const fields = [`Client Name: ${name}`, `Email: ${email}`, `Company: ${company}`, `Content Type: ${contentType}`, `Social/Website: ${profile || 'Not provided'}`, `Requested Service: ${service}`, `Date: ${dateLabel}`, `Time: ${timeLabel}`, `Business timezone: ${cfg.timeZone}`, `Client's timezone: ${visitorTimeZone} (${visitorDateLabel}, ${visitorTimeLabel})`, `Additional Information: ${message || 'None'}`].join('\n');
    await sendBookingEmail(token, cfg.businessEmail, 'NEW CLIENT CALL BOOKED', `NEW CLIENT CALL BOOKED\n\n${fields}`, cfg);
    let clientEmailSent = true;
    try {
      await sendBookingEmail(token, email, 'Your Clipping Rewards call is booked', `Hi ${name},\n\nYour Clipping Rewards consultation is confirmed.\n\nYour local time\nDate: ${visitorDateLabel}\nTime: ${visitorTimeLabel}\nTimezone: ${visitorTimeZone}\n\nBusiness calendar\nDate: ${dateLabel}\nTime: ${timeLabel}\nTimezone: ${cfg.timeZone}\nDuration: ${cfg.duration} minutes\n\nWe look forward to learning about your content.\n\nClipping Rewards`, cfg);
    } catch { clientEmailSent = false; }
    return NextResponse.json({ ok: true, date: visitorDateLabel, time: visitorTimeLabel, timeZone: visitorTimeZone, businessDate: dateLabel, businessTime: timeLabel, businessTimeZone: cfg.timeZone, duration: cfg.duration, clientEmailSent });
  } catch (error) {
    if (token && eventId) await deleteCalendarEvent(token, eventId, cfg).catch(() => undefined);
    if (error instanceof Error && error.message === 'BOOKING_SLOT_CONFLICT') return NextResponse.json({ error: 'That time was just taken. Please choose another available time.' }, { status: 409 });
    return NextResponse.json({ error: 'We could not confirm the booking just now. No appointment was reserved. Please try another time or email the team.' }, { status: 502 });
  } finally {
    activeSlots.delete(lock);
  }
}
