# Verification record

October 24, 2026. The custom form is restored and adapted to the exact six-column Apps Script supplied in `code.text`. The Google Forms embed has been removed.

## Automated checks

`node --test tests/*.test.js`: **17 tests passed**. JavaScript syntax and Git whitespace checks passed.

Verified event date/time, calendar escaping and line folding, the checked-in calendar, directions, required fields and 1–4 guest bounds, decline normalization, and production endpoint validation. New adapter checks verify `name`, `attending`, `partySize`, empty `email`, and labeled `notes` containing every optional field. Formula-like names are sent as literal text.

The exact supplied Apps Script is executed in a Node VM with mocked Google services. Its `setup()` creates six columns and the Summary formula. Integration tests verify that a three-person RSVP writes a count of 3, a decline writes 0, and all guest/dietary/message text is preserved in Notes. Its public health message contains no guest data.

The tests explicitly verify that this backend appends each repeated request. The frontend therefore does not promise safe retries. Opaque, malformed, HTTP/server, network, and timeout errors remain unconfirmed and tell guests to check with the host before resubmitting.

## Browser verification

The original invitation and custom form were visually checked at widths 375, 390, 430, 768 and 1280 px without horizontal overflow. The total-count field was verified visible before choosing attendance, hidden for declines, required for attending guests, and working with a three-person local test. The previous Google Forms-specific tests do not apply to this restored provider.

A separate local mock using the supplied `{result: "success", row: 2}` response verified the restored form’s three-person success screen. A simulated network failure kept the reply visible and disabled another submission, with an instruction to contact the host. No Google response was created during these checks.

The supplied `/exec` endpoint passed its health check. After publishing the restored site, a live browser submission from GitHub Pages sent one clearly labeled test decline with 0 guests. The browser received the expected success response with a valid saved-row number and displayed the decline confirmation, with no console errors. This verifies the deployed browser-to-Apps-Script path, including CORS and a server-confirmed write. The private Sheet and Summary cells were not directly inspected. The host can delete the labeled test row; it contributes zero to attendance.

The four-person limit update was checked with a local mocked successful RSVP for 4 people. The confirmation hides the attendance heading and introduction, and the section’s accessible label switches to the thank-you heading. No real response was created for this check.
