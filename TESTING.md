# Verification record

Checked October 24, 2026.

## Automated checks

`node --test tests/*.test.js`: **19 tests passed**. `node --check` also passed for the browser JavaScript modules.

Coverage includes required fields, 1–10 guest bounds, decline normalization, text limits, the exact Pacific date/time, calendar escaping and UTF-8 line folding, checked-in calendar consistency, directions configuration, endpoint validation, readable matching server confirmations, opaque/malformed/network/HTTP failures, timeout handling, server rejection, backend validation, spreadsheet formula protection, locked writes, duplicate request IDs, write-then-error recovery, and a health endpoint that reveals no guest data.

Apps Script tests execute `Code.gs` in a Node VM with mocked Google services. They verify the application logic, not Google deployment permissions, runtime service availability, quotas, or live cross-origin behavior.

## Browser checks for the original custom form

Used the in-app Chromium browser against a local HTTP server. Reviewed the original invitation screenshot, then visually inspected the recreated mobile and desktop layouts. Corrected the mobile botanical border to preserve ornament proportions.

At viewport widths **375, 390, 430, 768, and 1280 px**, the document’s scroll width equaled its client width: no horizontal overflow. Checked the small-screen and desktop layouts, readable event details, directions destination, calendar download link, and the production form’s unconfigured notice.

A separate temporary, clearly marked local test copy used fictional names and mocked fetch responses; it did not send any data to Google. Verified:

- Empty required fields prevent submission and focus the name field.
- Total people attending is visible before an attendance choice, including while setup is incomplete. The label explicitly includes the person replying and gives a party-size example. Selecting No hides the count; selecting Yes shows it and makes it required. Guest names and dietary fields appear only for Yes.
- Sending disables the button and fields.
- A network error retains and locks the pending reply, with an enabled retry button.
- Retrying a successful mock shows the attending confirmation.
- A decline shows the separate decline confirmation.
- A server validation rejection permits editing again.
- A timeout offers retry without claiming success.
- No browser console errors or warnings during these checks.

The mock copy is not part of the published site. The production bundle has no demo-success switch.

## Google Forms integration

The supplied responder URL is now the active provider. Automated checks verify URL validation, the embed query, the no-JavaScript iframe source, and that the custom form is initially hidden. The public form redirected to Google sign-in in the browser environment, and could not be inspected. No real response was submitted. Embedded form rendering, its count question, anonymous responder access and linked-sheet storage remain unverified. The website provides a direct-form fallback link and an explicit total-headcount reminder.

## Live checks still required

For the active Google Form, follow the Google Forms instructions in the README, confirm the count question includes the person replying, publish for the intended responders, and check a test response in the linked Sheet. The Apps Script checks below apply only if switching back to the optional custom form.


No real Google Apps Script endpoint was supplied during implementation. After following the README, verify anonymous access and both attending/declining submissions from the published GitHub Pages URL, and confirm the rows in the private Google Sheet. Test on physical iPhone/Safari and Android/Chrome as available; viewport simulation does not replace those device checks.

Confirm the exact street address and map pin with the host. Confirm an end time if one should appear in the calendar; none has been invented.
