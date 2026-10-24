// All event details and public integration settings live here. No secrets belong here.
export const CONFIG = Object.freeze({
  title: 'Shivani’s Baby Shower',
  name: 'Shivani',
  startsAt: '2026-12-13T10:00:00-08:00',
  lunchAt: '2026-12-13T11:00:00-08:00',
  endsAt: null, // End time is unknown; the calendar event intentionally has no end time.
  timeZone: 'America/Los_Angeles',
  venue: 'The Courtyard Hall',
  city: 'Sunnyvale, CA',
  streetAddress: '', // Add only when confirmed by the host.
  mapsUrl: '', // Optional exact Google Maps link; otherwise search venue + city.
  rsvpEndpoint: '', // Paste https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
  requestTimeoutMs: 25000,
});
