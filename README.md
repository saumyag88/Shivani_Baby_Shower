# Shivani’s Baby Shower

A mobile-first invitation for **Sunday, December 13, 2026**, with puja at **10:00 AM Pacific**, lunch and games at **11:00 AM Pacific**, at **The Courtyard Hall, Sunnyvale, CA**.

Plain HTML, CSS, JavaScript, and original SVG artwork. No framework, installation, build step, analytics, paid service, or external font is needed to serve the site. The active RSVP section embeds the host’s Google Form. Google Forms handles submissions and can save responses to a private Google Sheet. GitHub Pages serves the invitation. An optional custom Apps Script form is retained for hosts who prefer it.

**Before sharing with guests:** publish the Google Form for your intended responders, add the total-guest-count question, link its responses to a private Google Sheet, and submit a test response. Google Forms is selected by `googleFormUrl` in `config.js`; no Apps Script deployment is needed for this mode. The map is a venue search, not a verified street address. Confirm the venue pin before relying on it.

## Files

- `index.html` — invitation wording, accessible form, no-JavaScript event details.
- `styles.css` and `assets/` — responsive styling and original botanical/deer SVG illustrations.
- `config.js` — all event details and public integration settings.
- `script.js` — page behavior, conditional fields, submission and confirmation.
- `lib.js` — validation, calendar generation, directions and network handling.
- `shivani-baby-shower.ics` — downloadable calendar fallback.
- `google-apps-script/Code.gs` — backend to paste into Google Apps Script.
- `.nojekyll` — allows GitHub Pages to serve the files directly.
- `tests/site.test.js` — dependency-free tests; Node 20+ is only needed for development checks.

## Preview on your computer

Open Terminal in this folder and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000` in your browser. Stop the server with Control-C. Serve the folder over HTTP; opening `index.html` directly as a file will block JavaScript modules. The deployed GitHub Pages site uses HTTPS, which also supports the browser’s secure random IDs.

## Getting the RSVP form working

The active form is [the Google Form supplied by the host](https://docs.google.com/forms/d/e/1FAIpQLSe-GOG6Brla4kP1LSPl_xA_30YvRvUjAJ5fH1uKphJCCu4sdQ/viewform). The website embeds it at full available width and provides a direct link if the embedded form cannot load. It works without website JavaScript. Google controls the embedded questions, validation, confirmation, styling and response storage; the surrounding website cannot inspect or alter those cross-origin fields.

1. Open your form in the **Google Forms editor**. The public responder/embed link is not an editor link.
2. Include **Guest / family name** (required), **Will you be attending?** (required), and **Total people attending, including yourself** (required dropdown with values `0` through `10`). Add this description to the count question: **“You + 2 guests = 3. Include children. Choose 0 if you cannot attend.”** Guest names, dietary needs and a message can be optional questions. Using 0 for declines avoids needing conditional sections.
3. Click **Publish** (or **Published → Manage**) and check responder access. For guests without Google accounts, use **Anyone with the link**, disable **Limit to 1 response**, and avoid verified-email collection and file-upload questions that require sign-in. Organization policies can impose additional restrictions. Test the responder link in a signed-out/private browser window.
4. Open **Responses → Link to Sheets** (the green Sheets icon). Create a new spreadsheet or choose an existing one. Keep the response spreadsheet **Restricted**. Do not enable public response summaries.
5. Submit a fictional test response with a total of 3, then check that the linked sheet contains 3. Remove only your own test row/response afterward. Test a decline with a count of 0.
6. In the form’s settings, customize its confirmation message. The website does not show its own success message for embedded submissions and does not claim to know whether Google saved a response.

To see total guests, sum the **count column** in the linked spreadsheet. Google Forms’ response counter measures submissions, not people. For example, if your count is in column D of `Form Responses 1`, create a separate **Summary** tab and use:

```excel
=SUM(ARRAYFORMULA(IFERROR(VALUE('Form Responses 1'!D2:D),0)))
```

Replace `D` and the response-tab name with the actual column and tab in your sheet. Numeric conversion also handles dropdown values stored as text. Count 0 for anyone declining; remove duplicate submissions if guests submit more than once. The previously supplied formula for the custom Apps Script sheet is not applicable unless your Google Form happens to have the same columns.

The embedded form was verified on the published invitation without signing in. It contains Full Name, attendance, a total-people dropdown with options 1–5, and a combined comments/dietary-needs/well-wishes field. These fields show no required markers. In the Google Forms editor, enable Required for name, attendance and total count, and add 0 for declines (and 6–10 if needed). No real response was submitted; successful storage in the linked Sheet still needs a host test. The optional Google sign-in prompt saves progress and did not block the form. Adding the embed does not change Google permissions.

Official instructions: [publish and share a Google Form](https://support.google.com/docs/answer/2839588?hl=en) and [view and manage responses](https://support.google.com/docs/answer/139706?hl=en).

## Optional: use the original Apps Script form instead

Skip this section when using the supplied Google Form. To switch providers, set `googleFormUrl: ''` in `config.js`, then follow the instructions below and set `rsvpEndpoint`. The custom form shows total guest count upfront and hides it for declines. It stays disabled until the Apps Script endpoint is configured.


### 1. Create the private response sheet

1. Sign in to the Google account that will own the responses.
2. Create a **blank spreadsheet** in Google Sheets. Name it **Shivani Baby Shower RSVPs**.
3. Keep its sharing setting **Restricted**. Share with co-hosts individually only if needed. Do not publish the sheet to the web.
4. In the sheet, choose **Extensions → Apps Script**. A new editor opens. Name the project **Shivani RSVP**.

### 2. Add and authorize the script

5. Open this project’s `google-apps-script/Code.gs`. Copy its entire contents.
6. In the Apps Script editor, replace the starter contents of `Code.gs` with the copied code, then click **Save**.
7. In the function dropdown beside **Run**, select **setup**, then click **Run** once.
8. Google will ask you to authorize your own script. Select the account that owns the sheet and review the requested spreadsheet permission. If Google shows an unverified-app screen, confirm you are reviewing the script you just created; follow Google’s on-screen process yourself. Do not authorize an unfamiliar project.
9. Return to the spreadsheet. There should now be an **RSVPs** tab with eight columns: timestamp, family name, attending, count, guest names, dietary needs, message, and request ID.
10. `setup()` stores the spreadsheet ID privately in Apps Script’s **Script Properties**. You do not need to copy a sheet ID or any credential into the website. You can rerun `setup()` safely; it preserves responses and checks the headers.

### 3. Deploy a public submission endpoint

11. In Apps Script, click **Deploy → New deployment**.
12. Next to **Select type**, click the gear and choose **Web app**.
13. Set **Description** to `Baby shower RSVP v1`.
14. Set **Execute as** to **Me** (the account that owns the sheet).
15. Set **Who has access** to **Anyone**, including people who are not signed in. Do not choose “Anyone with a Google account.” Guests should not need to sign in. The endpoint is public for submissions; the spreadsheet stays private.
16. Click **Deploy** and complete any authorization Google requests.
17. Copy the **Web app URL**. It should look like `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`. Use the `/exec` URL, not the test `/dev` URL or the script editor URL.

If your organization does not offer anonymous “Anyone” access, a Google Workspace administrator may restrict it. Use a suitable personal Google account or ask your administrator; changing frontend code will not remove that restriction.

### 4. Connect the invitation

18. Open `config.js` and replace the empty `rsvpEndpoint` value:

```js
rsvpEndpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```

19. Save the file, commit and push it, then wait for GitHub Pages to publish the update. The endpoint URL is intentionally public, and is not a password. Never add OAuth tokens, service-account keys, or your private Sheet ID to the site.
20. Open the `/exec` URL in a signed-out/private browser window. You should see a short JSON health message. This confirms reachability only; it does **not** prove that spreadsheet writes work.
21. Open the published invitation in a private window. Send a test RSVP using clearly fictional test details. Confirm the thank-you screen **and** one corresponding row in the private sheet.
22. Test a decline and confirm the sheet stores `no`, a count of `0`, and empty guest/dietary fields. Remove only your own test rows afterward.
23. Test on an iPhone/Safari and Android/Chrome if available, including your actual shared GitHub Pages URL. Browser-to-Google behavior cannot be fully verified without a deployed endpoint.

### Updating Apps Script later

Saving the editor does not update a versioned deployment. Choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Editing the existing deployment preserves its URL. Creating a separate deployment gives a new URL, which must also be changed in `config.js`.

### How submission and error handling work

- The browser sends a `POST` with `URLSearchParams` (a standard form-encoded body), no custom headers, and no Google credentials. This avoids a CORS preflight. Google’s Content Service redirects the response; `fetch` follows that redirect.
- The site requires readable JSON containing `ok: true` and the matching request ID before displaying success. **Do not change the request to `mode: 'no-cors'`**: that hides the response and cannot confirm a save.
- While sending, the button and fields are disabled. A timeout or unreadable response is treated as **unconfirmed**, since the sheet may already have received it. The form keeps the same reply locked and offers **Retry the same RSVP**.
- The backend uses a script lock and checks the request ID in the sheet before appending. Retrying the same request does not add a second row, including after a write followed by a lost response. Keep the Request ID column and rows intact for this to work.
- The current tab stores only an ID and a hash of the pending reply in session storage, never guest text. If storage is unavailable, retries still work in memory. This is retry deduplication, not identity verification: a new tab or changed reply can create another entry. Ask guests to contact the host for changes.
- Validation runs in the browser and on the server. Declines always store zero guests. Input beginning with spreadsheet formula operators is stored as text. An invisible honeypot discourages basic automated spam.
- There is no public guest list or response-reading API. The public endpoint is still susceptible to spam or quota exhaustion; the honeypot is not authentication. Google applies service quotas. Archive/disable the web-app deployment after RSVPs close.

### Troubleshooting

| Symptom | What to check |
| --- | --- |
| “Online RSVPs aren’t open yet” | Paste the full `/exec` URL into `config.js`, save, deploy, then refresh. |
| Google sign-in page, HTML instead of JSON, or a permission error | Execute as **Me**; access **Anyone**; use `/exec`; test signed out. |
| Form says it cannot confirm | Check connectivity, deployment permissions, and browser extensions. Retry the same RSVP. Inspect the sheet before asking a guest to submit a new reply. Never assume a timeout means nothing was saved. |
| Endpoint is reachable but writes fail | Run `setup()` from the Sheet-bound editor, confirm the `RSVPs` tab and headers, and check the Apps Script **Executions** panel. Do not rename/delete the headers or Request ID column. |
| Old code still runs | Deploy a **New version** through **Manage deployments**, then refresh the site. |
| A CORS error remains | Confirm the request has no custom headers or JSON Content-Type, anonymous deployment is allowed, and the URL ends in `/exec`. Test the published site in a clean browser. Do not suppress CORS with `no-cors` or use a public proxy for guest details. |
| Form appears disabled when opening the downloaded HTML | Use the local HTTP server above or GitHub Pages; do not use a `file://` URL. |

## Deploying to GitHub Pages

Target repository: `https://github.com/saumyag88/Shivani_Baby_Shower`.

1. Place the **contents of this project folder** at the root of that repository, with `index.html` directly at the root. Preserve unrelated existing files.
2. Commit and push to `main` (or the branch you actually want to publish).
3. On GitHub, open the repository’s **Settings → Pages**.
4. Under **Build and deployment**, choose **Source: Deploy from a branch**.
5. Choose **Branch: main** and **Folder: /(root)**, then click **Save**.
6. Wait for the Pages deployment to complete. GitHub shows the published URL in the Pages settings. The expected project URL is `https://saumyag88.github.io/Shivani_Baby_Shower/` unless a custom domain is configured.
7. Open that URL, refresh it, test the directions and calendar links, and submit a test RSVP before sharing it.

GitHub Pages supports this static site without an Actions workflow. All local links are relative, so the repository subpath works. GitHub Free supports Pages for public repositories; private-repository Pages availability depends on the account plan. Do not change repository visibility without reviewing its existing contents.

### If GitHub is not connected on this Mac

Authenticate in Terminal (never paste a token into source files or chat):

```sh
gh auth login
```

Choose GitHub.com, HTTPS, and browser sign-in; allow the Git credential configuration when prompted. Then clone the existing repository into an empty directory:

```sh
git clone https://github.com/saumyag88/Shivani_Baby_Shower.git
cd Shivani_Baby_Shower
git status
```

Copy this project’s files into that checkout after reviewing any existing files, then:

```sh
node --test tests/*.test.js
git add index.html styles.css script.js lib.js config.js assets google-apps-script tools tests README.md TESTING.md package.json .gitignore .gitattributes .nojekyll shivani-baby-shower.ics
git diff --cached --check
git diff --cached
# Review the diff before committing.
git commit -m "Build baby shower invitation and RSVP site"
git push
```

If Git asks for an author, configure your own name and verified or GitHub-provided no-reply email using `git config user.name` and `git config user.email` in this repository. Never invent an author or force-push over existing history. If `main` is protected, use a new branch and pull request instead.

## Updating the invitation

Change values in `config.js`:

| Setting | Purpose |
| --- | --- |
| `name`, `title` | Honoree and calendar/page title |
| `startsAt` | Event date and puja start; an ISO date with the correct UTC offset |
| `lunchAt` | Lunch and games time |
| `timeZone` | Zone used to display times, currently `America/Los_Angeles` |
| `endsAt` | Set only when an end time is confirmed; currently `null` |
| `venue`, `city`, `streetAddress` | Venue and location; street address intentionally blank |
| `mapsUrl` | Optional verified HTTPS map link; empty means search the configured location |
| `googleFormUrl` | Active Google Forms responder URL; edit its questions in Google Forms |
| `rsvpEndpoint` | Optional Google Apps Script `/exec` URL, used only when `googleFormUrl` is empty |

December 13, 2026 is in Pacific Standard Time (`-08:00`), so 10 AM is `18:00Z`. If you change the date into daylight saving time, update the ISO offsets accordingly. The default calendar file has no end time; a calendar app may display its own default duration. Do not treat that as a confirmed event end.

If changing `googleFormUrl`, also update both the iframe source and fallback link in `index.html` for visitors without JavaScript.

With JavaScript enabled, the date, schedule, honoree, venue, map and generated calendar all read `config.js`. After changing details, also update the readable no-JavaScript fallback text, page description, and wording in `index.html`. Change the main invitation heading there. Update `lib.js`’s fixed event UID only if repurposing this project for a different event.

Regenerate the downloadable fallback after changing event details (Node 20+, no install needed):

```sh
node tools/write-calendar.js
node --test tests/*.test.js
```

Adjust palette, typography and spacing in `styles.css`. The desktop and mobile border SVGs are original vector illustrations; the reference screenshot and its proprietary artwork are not distributed with the project.

## Privacy and maintenance

The invitation is a publicly shareable URL; `noindex` asks search engines not to index it but is not access control. In Google Forms mode, RSVP data is stored by Google Forms and its linked Google Sheet, subject to the form and sheet sharing settings. No guest text is logged by the frontend, written to Git, sent to analytics, or included in calendar/map links. The embedded form loads content from Google and sends submissions directly to Google. Google Maps is contacted only when a guest opens directions. Do not put response exports, credentials, or private guest data into this repository. `.gitignore` excludes common exports and key files, but review every commit.

## Verification

Run `node --test tests/*.test.js`. See `TESTING.md` for what was checked and which live checks remain.

Official references: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [Content Service and response redirects](https://developers.google.com/apps-script/guides/content), and [GitHub Pages branch publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
