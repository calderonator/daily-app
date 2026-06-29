# Daily — Diego's training & life app

A standalone PWA: daily to-do list, structured training plan, nutrition, and schedule. Built in the style of the fencing-calendar PWA. Road to LA28.

## How it works
- **Plans** (`data/*.json`) are authored by Claude in the vault and pushed — the app reads them.
- **Your logs** (checkboxes, weight×reps, food, bodyweight) save on your phone (localStorage).
- **Sync loop (v1):** tap **"📋 Share my day"** → it copies/share-sheets a summary → paste it to Claude → Claude updates the plan and pushes it → app shows the new plan on next open.

## Tabs
- **Today** — to-dos, bodyweight, next-comp countdown, protein target
- **Train** — phase + sessions; log actual weight×reps per exercise
- **Eat** — calorie/macro targets, habits, food log
- **Schedule** — competitions + flights

## Deploy (GitHub Pages)
1. Create a new GitHub repo (e.g. `daily-app`), push these files.
2. Repo → Settings → Pages → deploy from `main` branch, root.
3. Open the HTTPS URL it gives you.
4. On Android Chrome: ⋮ menu → **Add to Home screen**.

## Data files
- `data/today.json` — today's focus + to-dos
- `data/plan.json` — periodized training plan
- `data/nutrition.json` — targets + habits
- `data/schedule.json` — comps + flights
