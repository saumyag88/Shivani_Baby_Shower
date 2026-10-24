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
  googleFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSe-GOG6Brla4kP1LSPl_xA_30YvRvUjAJ5fH1uKphJCCu4sdQ/viewform', // Active RSVP provider. Questions are edited in Google Forms.
  rsvpEndpoint: '', // Optional custom form: clear googleFormUrl and set an Apps Script /exec URL.
  requestTimeoutMs: 25000,
});
