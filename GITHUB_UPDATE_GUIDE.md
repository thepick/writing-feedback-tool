# Straightforward GitHub Update Workflow

This project is a static web tool. The important idea is that the live app is made from several files working together, especially:

- `index.html` - page layout and most of the visual structure
- `js/app/00-storage-sync-patches.js` - storage, settings, and sync behavior
- `js/app/10-main-app.js` - main app logic
- other `js/` files - smaller helper modules

## Recommended workflow for future updates

1. Create a backup first.
   - Download the current repository as a zip from GitHub.
   - Keep that zip unchanged in case you need to roll back.

2. Use GitHub Desktop for the easiest multi-file workflow.
   - Install GitHub Desktop.
   - Clone the repository to your computer.
   - Make a new branch before editing, such as `reorganize-settings`.

3. Replace or edit files locally.
   - For a ChatGPT-generated update, copy the changed files into the cloned folder.
   - Keep the same folder structure. For example, `js/app/10-main-app.js` must stay inside `js/app/`.

4. Test locally before publishing.
   - Open the project folder.
   - Start a simple local server.

   ```bash
   python -m http.server 8000
   ```

   - Open `http://localhost:8000` in your browser.
   - Check the main flows: Writing Tool, Portfolio, Manage Class, System Settings, saving settings, and Google sign-in if needed.

5. Commit the change.
   - In GitHub Desktop, review the changed files.
   - Write a clear commit message, such as `Reorganize class and system settings`.
   - Commit to your branch.

6. Publish the branch and open a pull request.
   - This lets you review the changes before they affect the main site.
   - Merge only after you are satisfied.

7. Roll back if needed.
   - In GitHub Desktop or on GitHub, revert the commit.
   - Because each update is committed, you do not have to guess which files changed.

## Quick method for small updates

For very small fixes, you can edit files directly on GitHub.com. This is fine for one file, but it becomes harder to manage safely when several files need to change together.

For multi-file updates, GitHub Desktop is the safest beginner-friendly method.

## What to send ChatGPT next time

When asking for another code update, send:

1. The current repository zip.
2. A short description of the change you want.
3. Any important constraints, such as "do not change the data format" or "keep this working on GitHub Pages."

Then ask for a modified zip plus a summary of changed files.
