import {CONFIG} from './config.js';
import {createIcs, endpointIsConfigured, mapsUrl, normalizeRsvp, submitRsvp} from './lib.js';

const byId = id => document.getElementById(id);
const format = (value, options) => new Intl.DateTimeFormat('en-US', {timeZone: CONFIG.timeZone, ...options}).format(new Date(value));
document.title = `${CONFIG.title} · ${format(CONFIG.startsAt, {month: 'long', day: 'numeric', year: 'numeric'})}`;
byId('honoree').textContent = `${CONFIG.name}’s`;
byId('event-date').textContent = format(CONFIG.startsAt, {weekday: 'long', month: 'long', day: 'numeric'});
byId('event-date').dateTime = CONFIG.startsAt;
byId('event-year').textContent = format(CONFIG.startsAt, {year: 'numeric'});
for (const [id, date] of [['puja-time', CONFIG.startsAt], ['lunch-time', CONFIG.lunchAt]]) {
  byId(id).textContent = format(date, {hour: 'numeric', minute: '2-digit'});
  byId(id).dateTime = date;
}
byId('venue').textContent = CONFIG.venue;
byId('location').textContent = [CONFIG.streetAddress, CONFIG.city].filter(Boolean).join(', ');
byId('footer-date').textContent = format(CONFIG.startsAt, {month: 'long', day: 'numeric', year: 'numeric'});
byId('directions-link').href = mapsUrl(CONFIG);
byId('directions-note').hidden = Boolean(CONFIG.streetAddress || CONFIG.mapsUrl);
const calendarUrl = URL.createObjectURL(new Blob([createIcs(CONFIG)], {type: 'text/calendar;charset=utf-8'}));
byId('calendar-link').href = calendarUrl;

const form = byId('rsvp-form');
const fields = byId('form-fields');
const submit = byId('submit-button');
const status = byId('form-status');
const label = byId('submit-label');
const configured = endpointIsConfigured(CONFIG.rsvpEndpoint);
byId('setup-notice').hidden = configured;
fields.disabled = !configured;
submit.disabled = !configured;
let busy = false;
let blockedAfterUnconfirmed = false;

function updateAttendance() {
  const answer = form.elements.attending.value;
  const yes = answer === 'yes';
  byId('count-field').hidden = answer === 'no';
  byId('guest-count').disabled = !configured || answer === 'no';
  byId('attending-fields').hidden = !yes;
  for (const input of byId('attending-fields').querySelectorAll('input, select, textarea')) input.disabled = !yes;
  byId('guest-count').required = yes;
}
updateAttendance();
form.addEventListener('change', event => {
  if (event.target.name === 'attending') updateAttendance();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || blockedAfterUnconfirmed || !configured) return;
  if (!form.reportValidity()) return;
  busy = true;
  submit.disabled = true;
  label.textContent = 'Sending your reply…';
  status.dataset.state = 'pending';
  status.textContent = 'Saving your RSVP. This may take a moment.';
  form.setAttribute('aria-busy', 'true');
  let keepLocked = false;
  try {
    const payload = normalizeRsvp(Object.fromEntries(new FormData(form)));
    fields.disabled = true;
    await submitRsvp(CONFIG.rsvpEndpoint, payload, {timeoutMs: CONFIG.requestTimeoutMs});
    const attending = payload.attending === 'yes';
    byId('confirmation-heading').textContent = attending ? 'Thank you!' : 'Thank you for letting us know.';
    byId('confirmation-message').textContent = attending ? 'We can’t wait to celebrate with you.' : 'We’ll miss celebrating with you!';
    form.hidden = true;
    byId('rsvp-intro').hidden = true;
    byId('rsvp').setAttribute('aria-labelledby', 'confirmation-heading');
    byId('confirmation').hidden = false;
    byId('confirmation').focus();
  } catch (error) {
    keepLocked = Boolean(error.uncertain);
    blockedAfterUnconfirmed = keepLocked;
    status.dataset.state = 'error';
    status.textContent = error.message || 'Something went wrong. Please try again.';
    label.textContent = keepLocked ? 'Please check with the host' : 'Send RSVP';
  } finally {
    busy = false;
    form.removeAttribute('aria-busy');
    fields.disabled = keepLocked;
    submit.disabled = keepLocked;
  }
});
