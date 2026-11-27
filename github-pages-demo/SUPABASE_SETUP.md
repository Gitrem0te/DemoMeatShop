# Supabase setup

This static internal inventory and POS app uses Supabase Auth, Postgres, and private Storage. It does not need or create a Supabase project. The PHP application remains separate and unchanged by this conversion; its existing demo accounts and database are not copied into Supabase.

## 1. Configure the frontend

1. In your existing Supabase project, open **Project Settings → API** (or **Connect**) and copy the project URL and publishable/anon key.
2. In `js/supabase.js`, replace:
   - `PASTE_YOUR_SUPABASE_PROJECT_URL` with the project URL.
   - `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY` with the publishable key (legacy projects may label this the `anon` key).
3. Do not use a `service_role` or secret key in this file, in HTML, in GitHub, or anywhere served to browsers. The publishable/anon key is intended for browser use; database access is restricted by RLS.

## 2. Create the database

1. In the Supabase Dashboard, open **SQL Editor → New query**.
2. Paste and run [`database/schema.sql`](./database/schema.sql) in the project. This schema is intended for a fresh database; do not run it over existing production tables without reviewing the migration impact.
3. Check that the query completed without errors. It creates the tables, constraints, indexes, Auth profile trigger, RLS policies, transactional RPCs, two private Storage buckets and sample inventory/settings.
4. The seeded products are clearly marked as samples. No Supabase Auth demo users or passwords are seeded.

The original MySQL `roles` table maps to the constrained `profiles.role` values (`admin` or `staff`). `auth.users` owns passwords and sessions; `profiles` stores application details. The PHP password hashes are not imported.

The existing category, product, stock movement, sale, sale item, payment, notification, user-notification, settings, and activity-log records map to their same-named Postgres tables. User records are split between `auth.users` and `profiles`. Reports are calculated from sales and inventory queries rather than stored in a `reports` table. Backup and restore tables/files are not ported; use Supabase exports instead.

## 3. Create and promote the first admin

1. In **Authentication → Users**, choose **Add user** and create your own account with a secure password. Confirm the email in the dashboard if prompted.
2. The schema trigger creates a matching `profiles` row with the `staff` role. In **SQL Editor**, run the following with the email you just created:

   ```sql
   update public.profiles
   set role = 'admin',
       is_owner = true,
       full_name = 'Your Name',
       status = 'Active'
   where email = 'you@example.com';
   ```

3. Confirm exactly one row was updated. Sign in at `login.html`. You can now use **Users → Add staff** to create additional staff accounts through the deployed Edge Function.
4. Keep admin credentials private. A GitHub Pages URL is public, but only users with valid Supabase accounts can use the app.

Existing PHP demo accounts remain in the original PHP/MySQL app. They are not automatically usable in Supabase; create separate test accounts in Supabase rather than sharing a public password.

## 4. Deploy the staff-management Edge Function

The browser must never create Auth users using the service-role key. The `supabase/functions/create-staff` function validates the caller's active admin profile and performs staff account creation/updates server-side.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and sign in:

   ```powershell
   supabase login
   ```

2. From the `github-pages-demo` folder, link the existing project and deploy:

   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy create-staff
   ```

   The project ref is the subdomain in your project URL, for example `abcdefgh.supabase.co` → `abcdefgh`.
3. The function uses Supabase's server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment values. Confirm those values are available under the project's Edge Function secrets/settings if deployment reports a missing configuration. Do not add the service-role key to frontend code or GitHub Pages.
4. In **Authentication → URL Configuration**, add the local test URL and the final GitHub Pages URL to the allowed redirect URLs. For a project site, the live URL is typically `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/`.

The function can create, edit, archive, restore, deactivate, or mark staff profiles deleted. It does not delete the Auth user as part of the normal UI actions. Marking a profile inactive/archived/deleted blocks application access through RLS.

## 5. Storage buckets and policies

The schema creates private `products` and `receipts` buckets and their access policies; verify them under **Storage** after running the SQL:

- `products`: admins can upload/update/delete product images; active signed-in staff can read images using short-lived signed URLs.
- `receipts`: private and restricted to the owner's folder or admins. Receipt printing currently happens in the browser, so this bucket is optional and is not required for the current sale flow.
- Do not create a browser-accessible `backups` bucket. Backups and restore are intentionally not ported.

Product stock is not writable through ordinary browser table updates. The app uses database RPCs for stock-in, sales, sale edits, and voids so quantity changes and movement history remain in the same transaction.

If you prefer the Dashboard instead of relying on the schema's bucket setup, create both buckets with **Public bucket** disabled. Keep the table policies added by `schema.sql`.

## 6. Sample inventory and test staff

The schema inserts sample categories, sample products, and general settings. Use the admin **Inventory** page to add/edit more items and **Stock** to record stock-in movements. New products start at zero stock; add the initial quantity via the stock screen so that a stock movement is recorded.

To add test staff, sign in as the admin, open **Users → Add staff**, and use a test email address you control. The Edge Function confirms staff email addresses at creation so you can test sign-in immediately. Prefer unique test passwords; avoid reusing or publishing credentials.

## 7. Backup and restore limitation

GitHub Pages cannot run the PHP/Python backup and restore handlers. The existing Python `backup_validator.py` and PHP `download.php` are deliberately not ported to the browser. Use Supabase's dashboard/database backup and export tools, or export/import CSV/SQL through the Supabase Dashboard. Restrict dashboard access to trusted project administrators and keep exports out of the public repository.

## 8. Test locally

After replacing the frontend placeholders, run a static HTTP server from the parent repository folder:

```powershell
py -m http.server 8000 --directory github-pages-demo
```

Open `http://localhost:8000/`. Do not open the HTML files as `file://`; ES modules and Supabase Auth require an HTTP origin. Confirm that you can sign in, see inventory, add stock, create/review/confirm a sale, print its receipt, and view reports. Test user creation with the admin account after deploying the Edge Function.

For table access troubleshooting, inspect the browser console and Supabase **Logs**. Do not work around an RLS error by making a bucket public or putting a service key in frontend code.
