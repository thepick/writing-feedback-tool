# Writing Feedback Tool

A browser-only writing analysis tool for teachers. It provides rubric scoring, corrected writing, structured feedback, student tracking, and optional Google Drive syncing.

## Features

- Analyze student writing with AI
- View rubric-based scores and feedback
- Save settings per browser
- Sync class data and portfolios to Google Drive
- No backend server required for the basic setup

## Requirements

Before using the tool, you will need:

- An OpenRouter API key
- A Google OAuth Client ID if you want Google Sign-In and Drive sync
- A static host such as GitHub Pages

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

### 2. Google OAuth setup

Google OAuth is only needed if you want Google Sign-In and Google Drive syncing.

#### Create the OAuth client

1. Go to https://console.cloud.google.com/
2. Create a new Google Cloud project, or select an existing one
3. Open "APIs & Services" > "Library"
4. Enable these APIs:
   - Google Drive API
   - Google People API, or Google OAuth2 API for user info
5. Open "APIs & Services" > "Credentials"
6. Click "Create Credentials"
7. Choose "OAuth client ID"
8. Select "Web application"

#### Add the required URLs

If you are using the current GitHub Pages setup shown in this project, use:

- Authorized JavaScript origins:
  - `https://thepick.github.io`

- Authorized redirect URIs:
  - `https://thepick.github.io/writing-feedback-tool`

If you fork this project or host it somewhere else, replace those values with your own deployed site URL and exact app path.

#### Finish Google setup

1. Save the OAuth client
2. Copy the generated Client ID
3. Open the Writing Feedback Tool
4. Click the Settings gear
5. Paste the Client ID into the "Google OAuth Client ID" field

## GitHub Pages notes

This project is set up for a browser-only OAuth implicit grant flow, so no backend server is required for Google Sign-In.

If you deploy to a different GitHub Pages URL, make sure you update:

- Authorized JavaScript origin
- Authorized redirect URI

Both must exactly match your deployed site.

## Settings behavior

The Settings panel includes:

- OpenRouter API Key
- Google OAuth Client ID
- AI model selection
- Grammar strictness
- Target word count

Important:

- The OpenRouter API key is stored in the browser
- The Google OAuth Client ID is also stored in the browser
- These values are not intended to be hardcoded into the file for normal use

## Basic usage

1. Open the tool
2. Add your OpenRouter API key in Settings
3. Add your Google OAuth Client ID in Settings if you want Drive sync
4. Enter or upload student writing
5. Run the analysis
6. Review feedback, corrected writing, and scores
7. Optionally sync portfolios to Google Drive

## Troubleshooting

### Google Sign-In does not work

Check the following:

- Your OAuth client type is "Web application"
- Your JavaScript origin is correct
- Your redirect URI exactly matches the deployed app URL
- The required Google APIs are enabled
- The Google OAuth Client ID is pasted into Settings

### AI analysis does not work

Check the following:

- Your OpenRouter API key is valid
- The API key was pasted into Settings correctly
- You selected a supported model
- Your browser is allowing local storage

## Security note

Because this is a browser-based tool:

- Treat your API key as private
- Do not share screenshots that reveal your key
- Remember that settings are stored locally in the browser you are using
