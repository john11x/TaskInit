# Daily Sales Log

A small sales log for a shop counter. Record an item, amount, and sale time, then see the total and running balances for a selected local calendar day.

## Project structure

```text
frontend/                 Static HTML, CSS, and JavaScript app
backend/supabase/migrations/  Supabase schema and RLS migrations
docs/PRD.md                Product requirements and manual verification data
```

## Setup

1. Create a Supabase project for demo data.
2. In the Supabase Dashboard, open **SQL Editor**. Run `202610130001_create_sales.sql` first, then `202610130002_allow_anonymous_sale_deletion.sql`.
3. In `frontend/app.js`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` using the project URL and publishable/anon key from **Project Settings → API Keys**.
4. Serve the static frontend locally. From the repository root, run:

	```sh
	cd frontend
	python3 -m http.server 8000
	```

5. Open [http://localhost:8000](http://localhost:8000) and log sales through the form.

## Netlify deployment

1. In Netlify, import this GitHub repository and set `main` as the production branch.
2. Leave the build command empty. `netlify.toml` publishes the existing `frontend/` folder, so no `dist/` build is needed.
3. Deploy the site once. After that, each push to `main` triggers a new production deploy and replaces the live site. Previous deploys remain available in Netlify's deploy history.

This app uses the browser-safe publishable/anon key. Never put a `service_role` or secret key in frontend code. The migrations deliberately allow anonymous reads and inserts, and the second migration allows anonymous deletes. Anyone with access to this demo can read, add, or delete its sales, so do not use real shop data.

## Notes

**What was built:** A no-build, mobile-first Daily Sales Log for a shop owner who needs to record a sale in seconds and trust the day's total at a glance.  I also wrote a short product spec: see [docs/PRD.md](docs/PRD.md).


**Decisions:**
- **Make the total trustworthy:** Keep prices to two decimal places and add them as cents, so rounding does not quietly change the day's total.
- **Show the day the owner expects:** Use the owner's local date. A sale after midnight belongs to the new day, even if the server is still on yesterday.
- **Make the demo easy to try:** Skip sign-in so reviewers can use it right away. That also means anyone can read, add, or delete demo sales. For a real shop, the owner must sign in before accessing sales.

**With one more day:** Add a quantity counter and unit price so each sale can show its calculated line total. Group item names case-insensitively, show how many times each item was sold, and mark the most-sold item with a fire icon in the ticker. Let the owner export a selected day's table as a simple sales statement with each sale, its running total, and the day's final total. Before using real shop data, add sign-in and per-shop ownership policies.
