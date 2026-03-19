# Supabase Setup (from scratch)

## 1. Create a new Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose organization, name it (e.g. "ScoreChore"), set a database password, pick a region.
4. Click **Create new project** and wait for it to finish.

## 2. Run the schema SQL

1. In your new project, open **SQL Editor**.
2. Click **New query**.
3. Copy the entire contents of `supabase-schema.sql` from this project.
4. Paste into the editor and click **Run** (or Ctrl+Enter).
5. You should see "Success. No rows returned" (or similar).

## 3. Get your API keys

1. Go to **Project Settings** → **API** (or **Data API** / **Connect**).
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (the publishable one, safe for client-side)

## 4. Update `.env.local`

Create or edit `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_PARENT_PIN=1234
```

Replace with your real values. **Do not commit `.env.local`** (it's in `.gitignore`).

## 5. Restart the dev server

```bash
# Stop with Ctrl+C, then:
npm run dev
# or
npm.cmd run dev
```

## 6. Test

- Open [http://localhost:3000](http://localhost:3000)
- Click **Open Parent Dashboard** → enter PIN `1234`
- Add a kid, add a job, add a reward
- Open **Kid Board** and claim/complete a job

---

### Optional: Board code for multiple families

To use board codes (so different families can have separate boards):

1. In Supabase **Table Editor** → `households`, add a new row with a unique `board_code` (e.g. `SMITH2024`).
2. Share the URL: `https://yoursite.com?board=SMITH2024` (or use the form on the home page).

**Board code is required** for both Kid Board and Parent Dashboard. There is no default household in the app anymore.

### Optional: Per-household parent PIN

Each family can have its own PIN for the parent dashboard:

1. Run the migration in Supabase SQL Editor: copy `supabase-migration-parent-pin.sql` and run it.
2. Parents can set their PIN in the dashboard: **Kids** tab → **Household settings** → enter PIN → **Save PIN**.
3. If no household PIN is set, the app falls back to `NEXT_PUBLIC_PARENT_PIN` from env.
