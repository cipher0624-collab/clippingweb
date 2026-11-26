'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, LoaderCircle } from 'lucide-react';

type CalendarData = { configured?: boolean; mode?: 'live' | 'request'; month?: string; days?: Record<string, string[]>; maxDate?: string; timeZone?: string; businessTimeZone?: string; duration?: number; email?: string; error?: string; date?: string; time?: string; clientEmailSent?: boolean };
const contentTypes = ['Podcast', 'YouTube', 'Interview', 'Livestream', 'Music', 'Personal Brand', 'Other'];
const serviceTypes = ['Short-form editing', 'Content repurposing', 'Clipping campaign', 'Distribution', 'Full short-form solution', 'Not sure yet'];
const initialMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const dateAtNoonUtc = (key: string) => { const [year, month, day] = key.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day, 12)); };
const dateKeyInZone = (date: Date, zone: string) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(x=>[x.type,x.value])); return `${p.year}-${p.month}-${p.day}`; };
const popularTimeZones = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
const availableTimeZones = () => typeof Intl.supportedValuesOf === 'function' ? Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])) : popularTimeZones;
const zoneLabel = (zone: string, instant = new Date()) => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts(instant).find(x => x.type === 'timeZoneName')?.value || zone;
  const abbreviation = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(instant).find(x => x.type === 'timeZoneName')?.value || '';
  return `${zone} — ${name}${abbreviation && abbreviation !== name ? ` (${abbreviation})` : ''}`;
};

function TimezonePicker({ value, zones, onChange }: { value: string; zones: string[]; onChange: (zone: string) => void }) {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = zones.filter(zone => !needle || zone.toLowerCase().includes(needle) || (popularTimeZones.includes(zone) && zoneLabel(zone).toLowerCase().includes(needle)));
    return matches.slice(0, 60);
  }, [query, zones]);
  return <div className="timezone-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}><label htmlFor="visitor-timezone">Your timezone</label><input id="visitor-timezone" type="search" role="combobox" aria-autocomplete="list" aria-controls="timezone-options" aria-expanded={open} value={query} placeholder={value} onFocus={()=>setOpen(true)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();document.querySelector<HTMLButtonElement>('#timezone-options button')?.focus();}if(event.key==='Escape')setOpen(false);}} onChange={event=>{setQuery(event.target.value);setOpen(true);}}/><small>{zoneLabel(value)}</small>{open&&<div className="timezone-options" id="timezone-options" role="listbox">{results.length?results.map(zone=><button type="button" role="option" aria-selected={zone===value} key={zone} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange(zone);setQuery('');setOpen(false);}}><b>{zone}</b><small>{popularTimeZones.includes(zone)?zoneLabel(zone):zone.replaceAll('_',' ')}</small></button>):<span className="timezone-no-results">No matching timezone</span>}</div>}</div>;
}

export default function BookingPage() {
  const [month, setMonth] = useState(initialMonth); const [timeZone, setTimeZone] = useState('Asia/Kolkata'); const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState(''); const [selectedTime, setSelectedTime] = useState('');
  const selectedInstant = useRef('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState<CalendarData | null>(null);
  const [requestDraft, setRequestDraft] = useState<{ gmailHref: string; subject: string; date: string; time: string; timeZone: string; duration: number; email: string; body: string } | null>(null);
  const [draftCopied, setDraftCopied] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', contentType: '', profile: '', service: '', message: '', websiteTrap: '' });
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setTimeZone(detected);
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: detected, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      setMonth(`${values.year}-${values.month}`);
    }
  }, []);
  useEffect(() => {
    let active = true;
    setCalendar(null); setError('');
    fetch(`/api/availability?month=${month}&timeZone=${encodeURIComponent(timeZone)}`, { cache: 'no-store' }).then(async response => {
      const data = await response.json() as CalendarData;
      if (!active) return;
      setCalendar(response.ok ? data : { configured: false, email: data.email || 'clippigreward@gmail.com', error: data.error });
      const found = Object.entries(data.days || {}).find(([, slots]) => slots.includes(selectedInstant.current));
      if (found && selectedInstant.current) setSelectedDate(found[0]);
      else if (selectedInstant.current) { selectedInstant.current = ''; setSelectedDate(''); setSelectedTime(''); }
    }).catch(() => { if (active) { setCalendar({ configured: false, error: 'Calendar is temporarily unavailable.' }); selectedInstant.current='';setSelectedDate('');setSelectedTime(''); } });
    return () => { active = false; };
  }, [month, timeZone]);

  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  const days = useMemo(() => calendar?.days || {}, [calendar]);
  const timeZones = useMemo(availableTimeZones, []);
  const currentDateKey = dateKeyInZone(new Date(), timeZone);
  const currentMonth = currentDateKey.slice(0, 7);
  const maxMonth = (calendar?.maxDate || currentDateKey).slice(0, 7);
  const changeMonth = (offset: number) => { const d = new Date(Date.UTC(year, monthNumber - 1 + offset, 1)); const target = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; if(target < currentMonth || target > maxMonth)return; selectedInstant.current='';setSelectedDate('');setSelectedTime('');setMonth(target); };
  const displayTime = (instant: string, zone = timeZone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(instant));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (calendar?.mode === 'request') {
        const instant = new Date(selectedTime);
        const localDate = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(instant);
        const localTime = displayTime(selectedTime);
        const businessDate = new Intl.DateTimeFormat('en-US', { timeZone: calendar.businessTimeZone || 'Asia/Kolkata', dateStyle: 'full' }).format(instant);
        const businessTime = new Intl.DateTimeFormat('en-US', { timeZone: calendar.businessTimeZone || 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(instant);
        const subject = `Consultation Request — ${form.name.trim()}`;
        const body = [`Consultation Request`, '', `Full name: ${form.name.trim()}`, `Email address: ${form.email.trim()}`, `Company / brand: ${form.company.trim()}`, `Content type: ${form.contentType}`, `Requested service: ${form.service}`, `Website / social profile: ${form.profile.trim() || 'Not provided'}`, '', `Preferred date: ${localDate}`, `Preferred time: ${localTime}`, `Timezone: ${timeZone} (${zoneLabel(timeZone, instant)})`, `Business calendar time: ${businessDate}, ${businessTime} (${calendar.businessTimeZone || 'Asia/Kolkata'})`, '', `Additional information:`, form.message.trim() || 'None'].join('\n');
        const recipient = calendar.email || 'clippigreward@gmail.com';
        const gmailParams = new URLSearchParams({ view: 'cm', fs: '1', to: recipient, su: subject, body });
        const gmailHref = `https://mail.google.com/mail/?${gmailParams.toString()}`;
        setRequestDraft({ gmailHref, subject, date: localDate, time: localTime, timeZone, duration: calendar.duration || 30, email: recipient, body });
        setBusy(false);
        return;
      }
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, startAt: selectedTime, visitorTimeZone: timeZone }) });
      const result = await response.json() as CalendarData;
      if (!response.ok) { setError(result.error || 'We could not complete that booking.'); setBusy(false); return; }
      setSuccess(result); setBusy(false);
    } catch { setError('We could not reach the booking service. Please try again.'); setBusy(false); }
  };

  if (requestDraft) return <main className="booking-page"><div className="booking-top"><Link href="/" className="booking-back"><ArrowLeft size={15}/> Back to Clipping Rewards</Link></div><section className="booking-success"><span className="success-icon"><CalendarDays size={24}/></span><div className="eyebrow"><span className="eyebrow-line"/>PREFERRED TIME SELECTED</div><h1>Request <em>ready.</em></h1><p>Your consultation details are ready. Open the prefilled Gmail draft to send your preferred time to the team for confirmation.</p><div className="success-details"><b><CalendarDays size={16}/>{requestDraft.date}</b><b><Clock3 size={16}/>{requestDraft.time}</b><small>{requestDraft.timeZone} · {requestDraft.duration}-minute consultation</small></div><a className="button button-pink" href={requestDraft.gmailHref} target="_blank" rel="noreferrer">Open Gmail draft <ArrowRight size={16}/></a><p className="request-note">The draft is addressed to {requestDraft.email} and includes your consultation details. Use Copy Email Details below if you need a backup.</p><button className="copy-request" onClick={async()=>{const text=`To: ${requestDraft.email}\nSubject: ${requestDraft.subject}\n\n${requestDraft.body}`;try{await navigator.clipboard.writeText(text);setDraftCopied(true);}catch{setError('Clipboard access is blocked. Please select and copy the consultation details, then email them to the address above.');}}}>{draftCopied?<><Check size={14}/> Email details copied</>:<>Copy email details</>}</button><p className="request-note">This is a preferred time request, not a confirmed booking.</p>{error&&<p className="booking-error" role="alert">{error}</p>}</section></main>;

  if (success) return <main className="booking-page"><div className="booking-top"><Link href="/" className="booking-back"><ArrowLeft size={15}/> Back to Clipping Rewards</Link></div><section className="booking-success"><span className="success-icon"><Check size={25}/></span><div className="eyebrow"><span className="eyebrow-line"/>YOU’RE ON THE CALENDAR</div><h1>Call <em>booked.</em></h1><p>{success.clientEmailSent ? 'We’ve sent the appointment details to your email. We look forward to hearing about your content.' : 'Your call is confirmed and the team has been notified. Please save the appointment details below; we could not send a confirmation email.'}</p><div className="success-details"><b><CalendarDays size={16}/>{success.date}</b><b><Clock3 size={16}/>{success.time}</b><small>{success.timeZone} · {success.duration} minutes</small></div><Link className="button button-pink" href="/">Back to the site <ArrowRight size={16}/></Link></section></main>;

  return <main className="booking-page"><div className="booking-top"><Link href="/" className="booking-back"><ArrowLeft size={15}/> Back to Clipping Rewards</Link><span>CLIPPING REWARDS <i>×</i> INTRO CALL</span></div><div className="booking-layout"><aside className="booking-aside"><div className="eyebrow"><span className="eyebrow-line"/>LET’S GET TO KNOW YOUR CONTENT</div><h1>Make room<br/>for a <em>good call.</em></h1><p>Choose a time to talk through your content, your goals, and what a Clipping Rewards campaign could look like.</p><div className="booking-meta"><span><Clock3 size={16}/> {calendar?.duration || 30} minute consultation</span><span><CalendarDays size={16}/> Online meeting</span><span className="timezone-line">Times shown in <b>{calendar?.timeZone || 'Asia/Kolkata'}</b></span></div><div className="booking-aside-bottom"><span>HAVE A QUESTION FIRST?</span><a href={`mailto:${calendar?.email || 'clippigreward@gmail.com'}`}>{calendar?.email || 'clippigreward@gmail.com'} <ArrowRight size={13}/></a></div></aside>
  <section className="booking-card"><div className="booking-card-head"><span>01 <i>—</i> PICK A DATE & TIME</span><small>{calendar?.mode === 'request' ? 'PREFERRED TIME · SUBJECT TO CONFIRMATION' : 'YOUR SELECTED TIMEZONE'}</small></div>
    {!calendar && <div className="calendar-loading"><LoaderCircle className="spinner"/>Checking available times…</div>}
    {calendar?.configured === false && <div className="calendar-unavailable"><span className="unavailable-mark">!</span><b>{calendar.error ? 'Our calendar is temporarily unavailable' : 'Online booking is unavailable right now'}</b><p>{calendar.error || 'Email us to arrange a time for your consultation.'}</p><a className="button button-pink" href={`mailto:${calendar.email || 'clippigreward@gmail.com'}?subject=Book%20a%20Clipping%20Rewards%20call`}>Email Clipping Rewards <ArrowRight size={15}/></a></div>}
    {calendar?.configured && <><TimezonePicker value={timeZone} zones={timeZones} onChange={zone=>{if(selectedInstant.current){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit'}).formatToParts(new Date(selectedInstant.current));const local=Object.fromEntries(parts.map(part=>[part.type,part.value]));setMonth(`${local.year}-${local.month}`);}setTimeZone(zone);}}/><div className="calendar-month"><button aria-label="Previous month" disabled={month<=currentMonth} onClick={() => changeMonth(-1)}><ArrowLeft size={16}/></button><b>{monthLabel}</b><button aria-label="Next month" disabled={month>=maxMonth} onClick={() => changeMonth(1)}><ArrowRight size={16}/></button></div><div className="calendar-grid"><div className="calendar-weekdays">{['M','T','W','T','F','S','S'].map((d,i)=><span key={`${d}${i}`}>{d}</span>)}</div><div className="calendar-days">{Array.from({length:firstWeekday},(_,i)=><span key={`blank${i}`} className="empty-day"/>)}{Array.from({length:daysInMonth},(_,i)=>{const day=i+1;const key=dateKey(year,monthNumber,day);const available=Boolean(days[key]?.length);const label=new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeZone:'UTC'}).format(dateAtNoonUtc(key));return <button key={key} disabled={!available} aria-label={`${label}${available?', available':''}`} aria-pressed={selectedDate===key} onClick={()=>{selectedInstant.current='';setSelectedDate(key);setSelectedTime('');setError('');}}>{day}</button>;})}</div></div>{selectedDate&&<div className="time-picker"><div><b>{calendar.mode === 'request' ? 'Preferred times' : 'Available times'}</b><small>{new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(dateAtNoonUtc(selectedDate))} · {zoneLabel(timeZone)}</small></div><div className="time-options">{(days[selectedDate]||[]).map(instant=><button key={instant} aria-pressed={selectedTime===instant} onClick={()=>{selectedInstant.current=instant;setSelectedTime(instant);setError('');}}>{displayTime(instant)}</button>)}</div>{selectedTime&&<div className="chosen-time"><span>{calendar.mode === 'request' ? 'YOUR PREFERRED TIME' : 'YOUR SELECTED TIME'}</span><b>{new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',timeZone}).format(new Date(selectedTime))}</b><b>{displayTime(selectedTime)}</b><small>{zoneLabel(timeZone,new Date(selectedTime))}</small></div>}</div>}<p className="calendar-legend"><i/>{calendar.mode === 'request' ? 'Time preferences · the team will confirm by email' : `Available times · Meeting length ${calendar.duration} min`}</p></>}
  </section>

  <section className={`booking-form-card ${!selectedTime||!calendar?.configured?'form-disabled':''}`}><div className="booking-card-head"><span>02 <i>—</i> YOUR DETAILS</span><small>ALL FIELDS MARKED * ARE REQUIRED</small></div><form onSubmit={submit}><div className="form-grid"><label>Full name *<input required maxLength={120} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label><label>Email address *<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@company.com"/></label><label>Company / brand *<input required maxLength={160} autoComplete="organization" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Your brand or company"/></label><label>What type of content do you make? *<select required value={form.contentType} onChange={e=>setForm({...form,contentType:e.target.value})}><option value="" disabled>Select content type</option>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></label><label className="field-wide">Website / social profile<input maxLength={500} value={form.profile} onChange={e=>setForm({...form,profile:e.target.value})} placeholder="https:// or @handle"/></label><label className="field-wide">What are you looking for? *<select required value={form.service} onChange={e=>setForm({...form,service:e.target.value})}><option value="" disabled>Select a service</option>{serviceTypes.map(x=><option key={x}>{x}</option>)}</select></label><label className="field-wide">Additional information<textarea rows={3} maxLength={3000} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Anything you'd like us to know before the call?"/></label><label className="honeypot" aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={form.websiteTrap} onChange={e=>setForm({...form,websiteTrap:e.target.value})}/></label></div>{error&&<p className="booking-error" role="alert">{error}</p>}<button type="submit" className="button button-pink confirm-booking" disabled={busy||!selectedTime||!calendar?.configured}>{busy?<><LoaderCircle className="spinner" size={16}/> Confirming…</>:calendar?.mode === 'request' ? <>Prepare time request <ArrowRight size={16}/></> : <>Confirm call <ArrowRight size={16}/></>}</button><p className="secure-note">{calendar?.mode === 'request' ? 'Your details will be placed in an email draft for you to send.' : 'Your details are used only to coordinate this consultation.'}</p></form></section></div><footer className="booking-footer"><Link href="/">CLIPPING REWARDS</Link><span>BLACK / PINK / SHORT-FORM</span></footer></main>;
}

