import { NextRequest, NextResponse } from 'next/server';
import { calendarConfigured, clockAt, dateParts, freeBusy, googleToken, localDateTime, settings, validTimeZone } from '../../lib/booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const cfg = settings();
  const zone = request.nextUrl.searchParams.get('timeZone') || cfg.timeZone;
  if (!validTimeZone(zone)) return NextResponse.json({ error: 'Choose a valid timezone.' }, { status: 400 });
  const requestedMonth = request.nextUrl.searchParams.get('month') || dateParts(new Date(), zone).date.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 });
  const liveCalendar = calendarConfigured();
  try {
    const [year, month] = requestedMonth.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1) - 2 * 86400000);
    const monthEnd = new Date(Date.UTC(year, month, 1) + 2 * 86400000);
    const today = dateParts(new Date(), cfg.timeZone);
    const maxDate = new Date(Date.now() + cfg.maxDaysAhead * 86400000);
    const rangeStart = localDateTime(today.date, '00:00', cfg.timeZone);
    const rangeEnd = localDateTime(dateParts(maxDate, cfg.timeZone).date, '23:59', cfg.timeZone);
    const token = liveCalendar ? await googleToken() : '';
    const busy = liveCalendar ? await freeBusy(token, new Date(rangeStart.getTime() - cfg.buffer * 60000), new Date(rangeEnd.getTime() + cfg.buffer * 60000), cfg) : [];
    const taken = busy.map(item => ({ start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }));
    const firstBusinessDay = dateParts(monthStart, cfg.timeZone).date;
    const lastBusinessDay = dateParts(monthEnd, cfg.timeZone).date;
    const [firstYear, firstMonth, firstDay] = firstBusinessDay.split('-').map(Number);
    const [lastYear, lastMonth, lastDay] = lastBusinessDay.split('-').map(Number);
    const first = new Date(Date.UTC(firstYear, firstMonth - 1, firstDay, 12));
    const last = new Date(Date.UTC(lastYear, lastMonth - 1, lastDay, 12));
    const days: Record<string, string[]> = {};
    const step = cfg.duration + cfg.buffer;
    const businessDateCount = Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1;
    for (let offset = 0; offset < businessDateCount; offset++) {
      const d = new Date(first.getTime() + offset * 86400000);
      const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const weekday = d.getUTCDay() || 7;
      if ((liveCalendar && !cfg.workingDays.includes(weekday)) || dayKey < today.date || dayKey > dateParts(maxDate, cfg.timeZone).date) continue;
      for (let minute = cfg.startMinutes; minute + cfg.duration <= cfg.endMinutes; minute += step) {
        const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        const startAt = localDateTime(dayKey, time, cfg.timeZone);
        if (dateParts(startAt, cfg.timeZone).date !== dayKey || clockAt(startAt, cfg.timeZone) !== time) continue;
        if (startAt.getTime() <= Date.now()) continue;
        if (liveCalendar && startAt.getTime() < Date.now() + cfg.minNoticeHours * 3600000) continue;
        const local = dateParts(startAt, zone);
        if (local.year !== year || local.month !== month) continue;
        const paddedStart = startAt.getTime() - cfg.buffer * 60000;
        const paddedEnd = startAt.getTime() + (cfg.duration + cfg.buffer) * 60000;
        if (taken.some(item => paddedStart < item.end && paddedEnd > item.start)) continue;
        (days[local.date] ||= []).push(startAt.toISOString());
      }
    }
    return NextResponse.json({ configured: true, mode: liveCalendar ? 'live' : 'request', month: requestedMonth, days, maxDate: dateParts(maxDate, zone).date, timeZone: zone, businessTimeZone: cfg.timeZone, duration: cfg.duration, email: cfg.businessEmail }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'We could not load the calendar. Please try again shortly.' }, { status: 502 });
  }
}
