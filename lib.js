export function googleFormLinks(value) {
  const url = new URL(value);
  if (url.origin !== 'https://docs.google.com' || !/^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/.test(url.pathname)) {
    throw new Error('Use the published Google Forms responder URL ending in /viewform.');
  }
  const direct = `${url.origin}${url.pathname}`;
  return {direct, embed: `${direct}?embedded=true`};
}

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
  if (yes && (!Number.isInteger(count) || count < 1 || count > 10)) throw new Error('Please choose 1–10 guests.');
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

export async function submitRsvp(endpoint, payload, {timeoutMs = 25000, fetchImpl = fetch} = {}) {
  if (!endpointIsConfigured(endpoint)) throw new SubmissionError('Online RSVPs aren’t open yet. Please contact the host.', false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // URLSearchParams uses a CORS-safelisted content type: no preflight or custom headers.
    // Never use no-cors: an opaque response cannot prove that an RSVP was saved.
    const response = await fetchImpl(endpoint, {
      method: 'POST', body: new URLSearchParams(payload), mode: 'cors',
      credentials: 'omit', redirect: 'follow', signal: controller.signal,
    });
    if (!response.ok || response.type === 'opaque') throw new Error('Unconfirmed server response');
    const result = await response.json();
    if (result.requestId !== payload.requestId) throw new Error('Unmatched confirmation');
    if (result.ok !== true) {
      const message = result.code === 'INVALID_INPUT'
        ? 'Please check your reply and try again.'
        : 'We couldn’t save your reply just now. Please try again, or contact the host.';
      // Storage failures may happen after a write; only validation failures are known unsaved.
      throw new SubmissionError(message, result.code !== 'INVALID_INPUT');
    }
    return result;
  } catch (error) {
    if (error instanceof SubmissionError) throw error;
    throw new SubmissionError('We couldn’t confirm your RSVP. Your reply may have been saved. Please retry the same reply below; retries won’t add another entry. If this continues, contact the host.');
  } finally { clearTimeout(timer); }
}
