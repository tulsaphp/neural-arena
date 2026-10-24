<<<<<<< HEAD
# NEURAL ARENA — AI Engineering Championship

A responsive browser game concept built for GitHub Pages, with Supabase providing anonymous player sessions, room state, real-time updates, and server-validated scoring. No paid AI API is required. The first version teaches AI/ML concepts through deterministic educational simulations; it does not train a neural network.

## Game rules

- 2–4 players join a six-character room code.
- The room host starts the championship and advances each round.
- **Round 1 — Train the Brain:** choose a model for a small sensor dataset. The server gives 100 points for a threshold classifier, 70 for nearest-neighbor, or 30 for random guessing.
- **Round 2 — Debug the Machine:** identify the data-leakage fix. Fit preprocessing on training data only earns 100 points; the other choices earn 0.
- **Round 3 — Agent Battle:** select Scout, Harvester, or Optimizer. A server-side seeded simulation scores the choice from 64–98 points based on the arena condition and strategy.
- The highest total score wins. Ties are broken by Round 3 score; a remaining tie is a draw.
- Choices and points are written by SQL functions; browser clients are not granted direct write access to game tables.

## Publish like `tulsaphp.github.io/neural-arena`

### Part A — create the free multiplayer backend

1. Open [Supabase](https://supabase.com/) and create a project on its Free plan. This game does not need a paid AI API.
2. Open **SQL Editor** in the Supabase dashboard, create a new query, paste the complete contents of `supabase-setup.sql`, and run it.
3. In **Authentication → Sign In / Providers** (the exact menu label can vary), enable **Anonymous Sign-Ins**. The game uses anonymous sessions so friends can join without creating accounts.
4. Open **Project Settings → API** (or **Connect**) and copy the **Project URL** and the **public anon/publishable key**. Never use the `service_role` key in browser code.
5. Open `config.js` and replace both placeholder strings with your project URL and public key. Keep the file in the project because the browser needs these two public client values; the SQL policies/functions protect the data.

### Part B — put the files on GitHub

1. Open [your GitHub profile](https://github.com/tulsaphp) and click **New repository**.
2. Name it `neural-arena`. Choose **Public** (GitHub Free requires a public repository for GitHub Pages) and create the repository.
3. Open the new repository and choose **Add file → Upload files**. Upload the contents of this folder (not the containing `neural-arena` folder itself), including `index.html`, `styles.css`, `app.js`, `config.js`, `supabase-setup.sql`, `favicon.svg`, `README.md`, and `.nojekyll`. Commit the upload to `main`.
4. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, and save.
5. After GitHub finishes publishing, the game URL should be:
   `https://tulsaphp.github.io/neural-arena/`
6. Open the URL on your computer and on a phone or another browser. Enter different player names, create a room on one device, join its code on the other, then complete all three rounds.

Official GitHub Pages guide: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
Supabase JavaScript guide: https://supabase.com/docs/reference/javascript/installing

## Local preview

Open `index.html` in a browser to inspect the design. Live room creation is intentionally disabled until `config.js` is filled in and the SQL setup has been run. If you use a local HTTP server for testing, don't use a `file://` URL for final multiplayer testing.

## Troubleshooting

- **“Anonymous sign-in failed”** — enable Anonymous Sign-Ins under Supabase Authentication settings.
- **“relation does not exist” / RPC not found** — run all of `supabase-setup.sql` in the correct Supabase project.
- **No live updates** — confirm the SQL completed, the two tables are in the `supabase_realtime` publication, and the game has internet access.
- **Code fails to connect** — check that `config.js` contains the correct Project URL and public anon/publishable key; never paste your service-role key.
- **GitHub Pages shows a 404** — confirm `index.html` is at the repository root and Pages is configured to deploy from `main` / root.

## Security notes

The frontend contains only the Supabase public client key, never the service-role key. RLS limits reads to players in a room. All room mutations, stage transitions, and scoring run through server-side SQL functions, and the browser role has no direct table write privileges. This is a starter educational game; for a larger public launch, add anti-abuse controls (rate limits, room expiry/cleanup, moderation, and monitoring).
=======
