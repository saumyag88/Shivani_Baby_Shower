export function endpointIsConfigured(endpoint) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
}

export function normalizeRsvp(input) {
  const value = (key, max, required = false) => {
    const text = String(input[key] ?? '').trim();
    if ((required && !text) || text.length > max) throw new Error(`Please check ${key === 'familyName' ? 'your family name' : key}.`);
    return text;
  };
  const familyName = value('familyName', 120, true);
  if (!['yes', 'no'].includes(input.attending)) throw new Error('Please choose whether you’ll be attending.');
  const yes = input.attending === 'yes';
  const count = yes ? Number(input.count) : 0;
  if (yes && (!Number.isInteger(count) || count < 1 || count > 4)) throw new Error('Please choose 1–4 people, including yourself.');
  return {
    familyName, attending: input.attending, count,
    guestNames: yes ? value('guestNames', 500) : '',
    dietaryNeeds: yes ? value('dietaryNeeds', 500) : '',
    message: value('message', 1500), website: value('website', 200),
  };
}

export function mapsUrl(config) {
  if (config.mapsUrl) {
    const url = new URL(config.mapsUrl);
    if (url.protocol !== 'https:') throw new Error('Maps URL must use HTTPS.');
    return url.href;
  }
  const destination = [config.venue, config.streetAddress, config.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

export function createIcs(config, generatedAt = new Date()) {
  const escape = text => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const time = value => new Intl.DateTimeFormat('en-US', {timeZone: config.timeZone, hour: 'numeric', minute: '2-digit'}).format(new Date(value));
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shivani Baby Shower//Invitation//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:shivani-baby-shower-20261213@invitation.local', `DTSTAMP:${stamp(generatedAt)}`,
    `DTSTART:${stamp(config.startsAt)}`,
  ];
  if (config.endsAt) lines.push(`DTEND:${stamp(config.endsAt)}`);
  lines.push(`SUMMARY:${escape(config.title)}`,
    `LOCATION:${escape([config.venue, config.streetAddress, config.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escape(`Join us to celebrate ${config.title}.\nPuja at ${time(config.startsAt)}. Lunch & Games at ${time(config.lunchAt)}.\nAll times ${config.timeZone}.${config.endsAt ? '' : ' End time to be confirmed.'}${config.streetAddress ? '' : '\nPlease confirm the exact street address with the host.'}`)}`,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
  // RFC 5545: CRLF and folded lines of at most 75 UTF-8 octets.
  const encoder = new TextEncoder();
  return lines.map(line => {
    let folded = '', length = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (length + size > 75) { folded += '\r\n '; length = 1; }
      folded += char; length += size;
    }
    return folded;
  }).join('\r\n') + '\r\n';
}

export class SubmissionError extends Error {
  constructor(message, uncertain = true) { super(message); this.uncertain = uncertain; }
}

// Match the six-column Apps Script supplied by the host. Optional details share Notes.
export function toAppsScriptPayload(input) {
  const value = normalizeRsvp(input);
  if (value.website) throw new SubmissionError('Please leave the website field empty.', false);
  const asText = text => /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
  const notes = [
    value.guestNames && `Guest names: ${value.guestNames}`,
    value.dietaryNeeds && `Dietary needs: ${value.dietaryNeeds}`,
    value.message && `Message: ${value.message}`,
  ].filter(Boolean).join('\n');
  return {name: asText(value.familyName), attending: value.attending,
    partySize: value.count, email: '', notes: asText(notes)};
}

export async function submitRsvp(endpoint, payload, {timeoutMs = 25000, fetchImpl = fetch} = {}) {
  if (!endpointIsConfigured(endpoint)) throw new SubmissionError('Online RSVPs aren’t open yet. Please contact the host.', false);
  const body = new URLSearchParams(toAppsScriptPayload(payload));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Form-encoded POST avoids CORS preflight; never treat an opaque response as saved.
    const response = await fetchImpl(endpoint, {
      method: 'POST', body, mode: 'cors', credentials: 'omit',
      redirect: 'follow', signal: controller.signal,
    });
    if (!response.ok || response.type === 'opaque') throw new Error('Unconfirmed server response');
    const result = await response.json();
    if (result.result !== 'success' || !Number.isInteger(result.row) || result.row < 2) {
      throw new Error('No saved-row confirmation');
    }
    return result;
  } catch {
    // This deployed script has no idempotency key. A lost acknowledgement cannot be retried safely.
    throw new SubmissionError('We couldn’t confirm your RSVP. It may already have been saved. Please contact the host before submitting again so your guests aren’t counted twice.');
  } finally { clearTimeout(timer); }
}
