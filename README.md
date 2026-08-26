# Class Test Portal — setup

## What this does
- Students log in by typing their **own name + roll number**, plus **one shared test password** you announce at test time — no roster to pre-load.
- The first time a roll number logs in, that name gets locked in for it. If someone tries the same roll number with a different name later, they're blocked — this stops one student from opening another's in-progress test just by knowing their roll number.
- 100 MCQs + 15 coding programs (edit `questions.json` to add your real questions — a small template is in there now).
- **Autosave**: every answer (MCQ click, every code keystroke) is saved to the cloud within ~1 second, and again immediately if the tab closes or loses focus.
- **Resume**: if a student's tab crashes, closes by accident, or their internet drops, they log in again with the same name + roll number and land back exactly where they left off, all code intact. Nothing is ever cleared automatically — the only way a program's code gets wiped is the student clicking "Reset to starter code" and confirming it.
- **Auto-grading**: on Submit, each of the 15 programs runs against its test cases (via the free Piston execution service) and is scored automatically; MCQs score instantly. Every network call to Piston retries with increasing backoff (up to ~4 tries per test case) before giving up on that one test case — grading is deliberately slow rather than skipping anything.
- **Admin dashboard** (`admin.html`): live results table, search/sort, CSV export, and a **Regrade** button (per student or "Regrade all") in case the execution service was down or slow during someone's original submission.

## Setup

1. **Create a Firebase project** — console.firebase.google.com → "Add project" (free, no card needed).
2. **Build → Firestore Database → Create database → Start in test mode.** Pick a region close to you.
3. **Project settings → General → Your apps → Web app (`</>`)** → register it, copy the config it shows you.
4. Paste those values into `firebase-config.js` (replace the `PASTE_HERE`s).
5. In `firebase-config.js`, set `ADMIN_PASSWORD` (for admin.html) and `STUDENT_PASSWORD` (the one password you'll tell the whole class at test time) to your own values.
6. Edit `questions.json`: add your real 100 MCQs and 15 programs, following the existing structure. Keep `id`s unique.
7. Push this folder to a GitHub repo → **Settings → Pages** → deploy from the branch/folder, same as your existing GitHub Pages sites.
8. Share the `index.html` link and the test password with students at test time.

## Before the real test: do one dry run
Open `index.html` in a private/incognito window, log in as a test student, answer a couple of things, and close the tab without submitting. Log in again with the same name + roll — confirm your answers are still there. Then check `admin.html` and confirm that student shows up as "in-progress".

## Things to know
- **Firestore is in "test mode"**, open for ~30 days from when you created it — fine for a classroom test, but a student who opens browser dev tools could technically read/write others' submissions. I can help set up proper Firestore Security Rules afterward if you want this locked down for repeat use.
- **Piston (the free execution API) is shared publicly.** With many students submitting close together, some test cases may need several retries — that's expected and handled automatically, it just makes Submit slower rather than less accurate. If a student's grading still looks off afterward (e.g. the service was down for their whole submission), use **Regrade** in admin.html to re-run their program's test cases without them needing to resubmit.
- The editor is a plain textarea — no syntax highlighting, no anti-cheat, no proctoring. Matches "keep it simple." Happy to add a proper code editor or anti-cheat measures as a follow-up.