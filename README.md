# Writing Feedback Tool

A browser-only writing analysis tool for teachers. It provides rubric scoring, corrected writing, structured feedback, student tracking, and optional Google Drive syncing.

The page loads classic browser scripts in this order: `google-drive-migration.js`, `js/app/dialogs.js`, `js/app/storage-recovery.js`, `js/app/00-storage-sync-patches.js`, `js/app/portfolio-export.js`, `js/app/10-main-app.js`, `js/app/photo-crop.js`, then `js/app/99-lightbox.js` after its markup. Keep that order: main initializes the page immediately and retains the crop-state assignments; crop functions bind the modal on DOMContentLoaded.

Dialogs, storage recovery/backup, portfolio exports/archives, and photo cropping each have one source file. The storage script retains settings, configuration, authentication, sync, portfolio persistence and display. Main retains roster, analysis, feedback, notebook printing, image input and page initialization. Public functions and state remain browser globals used by existing handlers. Tests under `tests/` exercise shipped code. See [current script locations](docs/script-locations.md) when following historical audit references, which retain their original source locations.

## Features

- Analyze student writing with AI
- View rubric-based scores and feedback
- Save settings per browser
- Sync class data and portfolios to Google Drive
- No backend server required for the basic setup
- Google Sign-In is preconfigured in the tool

## Requirements

Before using the tool, you will need:

- An OpenRouter API key
- A static host such as GitHub Pages

## Setup

### 1. OpenRouter API key

This tool uses OpenRouter for AI analysis.

All AI requests use [Gemini Flash Latest](https://openrouter.ai/~google/gemini-flash-latest) (`~google/gemini-flash-latest`), including writing feedback, image text extraction, and handwriting assessment. OpenRouter automatically resolves this alias to the latest Gemini Flash release, so the underlying version and pricing can change. Failed requests retry the same model; there are no alternate-model fallbacks. Older saved model preferences are ignored.

Steps:

1. Go to https://openrouter.ai/
2. Sign in or create an account
3. Open your account settings or API key page
4. Create a new API key
5. Copy the key
6. Open the Writing Feedback Tool
7. Click the Settings gear
8. Paste the key into the "OpenRouter API Key" field

Notes:

- The API key is saved in this browser only
- Each teacher can use their own key without editing the code
- The API key is not shared with other users or browsers

### 2. Google Sign-In, grading records, and portfolios

Google Sign-In is used for optional Google Drive syncing.

When Google Drive syncing is used, the tool can help save and organize student writing records over time. This makes it easier to review progress, compare earlier and later writing, and keep portfolio evidence in one place.

The tool can save records that include:

- Student name
- Date of the writing analysis
- Original student writing
- Corrected version of the writing
- Overall score
- Rubric category scores
- Strengths and areas for improvement
- Teacher-facing feedback
- Student-friendly feedback
- Writing goals or next steps
- Uploaded handwriting images, when included
- Neatness feedback, when handwriting assessment is enabled

Portfolio records can be used to:

- Track growth across multiple writing samples
- Review a student's progress over time
- Compare rubric scores between assignments
- Keep evidence for parent conferences or report comments
- Support targeted writing instruction
- Print or review individual feedback records
- Maintain writing history without relying only on the current browser

To use Google Drive syncing:

1. Open the Writing Feedback Tool
2. Sign in with Google when prompted
3. Allow the requested permissions
4. Run writing analyses for your students
5. Use the sync options in the tool to save class data and student portfolio records to Google Drive

If you do not sign in with Google, the tool can still be used for writing analysis. However, portfolio syncing and Google Drive backup features will not be available.

## Google Cloud setup notes

This version is intended to work with the included Google Sign-In configuration.

If the tool is hosted somewhere else, the built-in Google Sign-In configuration may not work unless that new deployed URL is also added to the OAuth client's authorized origins and redirect URIs in Google Cloud Console.

## GitHub Pages notes

This project uses a browser-only OAuth redirect flow, so no backend server is required for Google Sign-In.

If you deploy to a different GitHub Pages URL, make sure the Google OAuth client has been updated to include:

- The correct Authorized JavaScript origin
- The correct Authorized redirect URI

Both must exactly match the deployed site.

## Settings behavior

The Settings panel includes:

- OpenRouter API Key
- Gemini Flash Latest (fixed model)
- Grammar strictness
- Target word count
- The option to assess script quality

Important:

- The OpenRouter API key is stored in the browser
- Google Sign-In is configured in the code
- Teachers only need to enter their own OpenRouter API key

## Basic usage

1. Open the tool
2. Add your OpenRouter API key in Settings
3. Set your writing options
4. Enter or upload student writing
5. Run the analysis
6. Review feedback, corrected writing, and scores
7. Optionally sign in with Google and sync portfolios to Google Drive

## Troubleshooting

### Google Sign-In does not work

Check the following:

- The site is being opened from an authorized URL
- The Authorized JavaScript origin matches the deployed site
- The Authorized redirect URI exactly matches the deployed app URL
- The required Google APIs are enabled
- Pop-ups or redirects are not being blocked by the browser
- You are using the updated version of the tool with Google Sign-In configured in the code

### Google Drive sync does not work

Check the following:

- You are signed in with Google
- You allowed the requested Google permissions
- Google Drive API is enabled for the OAuth project
- Your browser is not blocking third-party sign-in or pop-up windows
- The deployed URL is authorized in the Google Cloud OAuth settings

### AI analysis does not work

Check the following:

- Your OpenRouter API key is valid
- The API key was pasted into Settings correctly
- Gemini Flash Latest is available through OpenRouter
- Your browser is allowing local storage
- Your OpenRouter account has enough credits and access for Gemini Flash Latest

## Security note

Because this is a browser-based tool:

- Treat your OpenRouter API key as private
- Do not share screenshots that reveal your key
- Remember that settings are stored locally in the browser you are using

## Local regression tests

Install the test dependencies once (Playwright and JSZip; the browser suites drive the installed Microsoft Edge), then run:

```powershell
npm install
node scripts/check-test-runner.cjs
node scripts/run-tests.cjs --out ./test-results
node scripts/run-tests.cjs --out ./test-results-focused --suite tests/openrouter-failures.browser.cjs
```

The runner syntax checks the application, tests and scripts, then runs each discovered top-level `tests/*.cjs` suite and the root migration test in a separate process, sequentially. A failed or timed-out suite makes the final exit status nonzero. Logs and `suite-results.json` record the inventory, selection, status and duration; suites with case reports also save their JSON. Focused selections are marked partial. Reports are refreshed each run, and expected missing or empty reports fail. There are no automatic retries. Browser tests intercept external services and use synthetic writing and accounts.

Case-report requirements for repository suites are declared in `scripts/case-report-suites.json`; add a suite there when it starts emitting a report. Source text, including fixture strings and comments, does not determine this contract. Programmatic fixture callers can supply a `reportSuites` array instead.

Reports must contain a nonempty `cases` or `checks` array with an explicit boolean `pass` or `passed` result for every entry, or a positive integer `count`, `total` or `cases` equal to the numeric `passed` count. Empty objects, malformed result rows, incomplete summaries and explicit failure flags fail validation.

Native coverage is optional evidence tooling: `WFT_COVERAGE_PRELOAD` selects an external reviewed collector, and `WFT_SUPPLEMENTAL_MANIFEST` selects a JSON array of external drivers. String paths require reports. For a driver that intentionally emits none, use an explicit entry such as `{ "file": "scripts/check-test-runner.cjs", "reportRequired": false }`; paths resolve from the invoking working directory. Supplied reports are validated even when optional. Existing manifests with reportless string drivers must use this object form. The runner alone does not certify coverage. Source hashes, the eight loaded scripts, executable-line denominators and excluded frozen reference contexts must be verified separately. VM snippets do not establish native browser coverage; branch coverage and live service behavior remain unmeasured.
