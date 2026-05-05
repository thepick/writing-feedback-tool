# Writing Feedback Tool

A browser-only writing analysis tool for teachers. It provides rubric scoring, corrected writing, structured feedback, student tracking, and optional Google Drive syncing.

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

Google Sign-In and Drive syncing are already configured in the code. Teachers do not need to enter a Google OAuth Client ID in Settings.

## Setup

### 1. OpenRouter API key

This tool uses OpenRouter for AI analysis.

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

Google Sign-In is used for optional Google Drive syncing. Teachers do not need to enter a Google OAuth Client ID in Settings because Google Sign-In is already configured in the tool.

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

For the current GitHub Pages setup, the OAuth client should allow:

- Authorized JavaScript origins:
  - `https://thepick.github.io`

- Authorized redirect URIs:
  - `https://thepick.github.io/writing-feedback-tool`

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
- AI model selection
- Grammar strictness
- Target word count
- Script quality options

The Settings panel no longer includes a Google OAuth Client ID field.

Important:

- The OpenRouter API key is stored in the browser
- Google Sign-In is configured in the code
- Teachers only need to enter their own OpenRouter API key

## Basic usage

1. Open the tool
2. Add your OpenRouter API key in Settings
3. Choose the AI model and writing options you want
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

Teachers should not look for a Google OAuth Client ID field in Settings. That field has been removed.

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
- You selected a supported model
- Your browser is allowing local storage
- Your OpenRouter account has enough credits or access for the selected model

## Security note

Because this is a browser-based tool:

- Treat your OpenRouter API key as private
- Do not share screenshots that reveal your key
- Remember that settings are stored locally in the browser you are using
