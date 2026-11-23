# Mote

Mote is a mobile web gratitude journal. Each day you write three things you're thankful for, then revisit them by date. It is built with Vite, React and TypeScript from the Figma file "Mote (Thankful app)" and the Mote PRD.

## Setup

Requires Node 20 or newer.

```bash
npm install
npm run dev       # local dev server at http://localhost:5173
npm run build     # type-check and build the static site into dist/
npm run preview   # serve dist/ locally at http://localhost:4173
```

The layout targets portrait widths from 320 to 767 CSS pixels. At 768px and wider the app shows "Mote is designed for mobile. Open this link on your phone." To develop on a desktop, narrow the browser window or use the browser's device toolbar.

## How storage works

- Entries live only in this browser's `localStorage`, under the key `mote`. There are no accounts, no server and no analytics. Before the first save, the app tells the person that clearing browser data removes their entries.
- Storage is scoped to the origin. Dev (`localhost:5173`), preview (`localhost:4173`), Netlify deploy previews and production each keep separate entries, so a new production visitor always starts with an empty journal.
- Format, keyed by the device's local date:

  ```json
  { "version": 1, "entries": { "2026-11-20": { "responses": ["…", "…", "…"], "createdAt": "2026-11-21T02:00:00.000Z", "updatedAt": "2026-11-21T02:00:00.000Z" } } }
  ```

- All reads, saves and deletes go through `src/journal.ts`. Every write first re-reads the stored object, then writes it and reads it back. The UI reports success only after that check passes. If stored data is missing or can't be parsed, the app shows a banner and refuses to write, so existing data is never overwritten. Changes made in another tab update the screen through the `storage` event.
- Responses are trimmed and rendered as plain text. Entry text never goes into URLs, logs or network requests.

## Behaviour notes

- **Today.** Save stays disabled until all three fields have non-whitespace text. Unsaved text survives switching between Today and Look back during the session. Saving today's entry again replaces it and keeps `createdAt`.
- **Midnight.** The app rechecks the date every 30 seconds, when the page becomes visible, and right before saving. If the date changed while you were writing, it asks "It's a new day. Save this for today?" and does nothing until you choose. It never writes to the previous day, and it never replaces an existing entry for the new day.
- **Look back.** The List view groups entries by month, newest first, with expandable rows. The Calendar view opens on the current month. Changing months clears the selected date. Selecting a blank date shows "No entry for this date." Delete asks for confirmation. Cancel returns focus to the Delete button, and a successful delete is announced as "Entry deleted."

## Verification checklist

Run these checks against the PRD's acceptance criteria at widths of 320, 390 and 430 px, and again on a real phone:

1. With zero, one or two responses, or with spaces only in one field, Save stays disabled.
2. Save three responses. The confirmation shows all three. Reload, and the entry is still there.
3. Tap Edit. All three responses are pre-filled. Save, and the storage still holds one entry for today.
4. In List view, rows start collapsed. Tapping a row shows all three responses and Delete. Tapping again collapses it.
5. In Calendar view, change months, then select a saved date and a blank date.
6. Delete a past entry. Cancel keeps it. Delete removes it from both views, and it stays gone after a reload. Past entries have no Edit action.
7. Delete today's entry, and Today returns to the empty form. Delete the only entry, and Look back shows the empty journal.
8. Storage problems: in DevTools, set `localStorage.mote` to `{broken`. A banner appears, and Save fails visibly without overwriting the data.
9. At 768 px, the mobile-only notice appears.

## Deploy (Netlify)

`netlify.toml` already sets the build command (`npm run build`), the publish directory (`dist`), Node 20 and security headers.

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project → GitHub**, then pick the repository. The settings come from `netlify.toml`, so keep the defaults and click **Deploy**.
3. Optionally, rename the site under **Site configuration → Change site name** (for example `mote-journal.netlify.app`), or add a custom domain. HTTPS is automatic. Keep a single production URL, because changing it starts everyone with an empty journal.
4. Smoke test on the HTTPS URL: save a test entry, reload, open both Look back views, then delete the entry and reload again.

Every push to the main branch redeploys the site. Pull requests get their own deploy previews, and each preview has its own separate storage.

Other static hosts work the same way. Use build command `npm run build` and publish directory `dist`.

## Shareable preview build

`npm run build:preview` builds a single self-contained file in `dist-single/`. That build includes sample entries from the design, stores data under a separate key, and skips the wide-screen notice. It's meant for review only, not for production.
