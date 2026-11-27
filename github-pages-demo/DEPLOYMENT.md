# GitHub Pages deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. It publishes only the `github-pages-demo` directory; the original PHP project is not deployed to Pages.

## Before pushing

1. Complete [Supabase setup](./SUPABASE_SETUP.md), including running `database/schema.sql`, promoting your first admin, and deploying the `create-staff` Edge Function.
2. Replace the two Supabase placeholders in `js/supabase.js` with the project URL and publishable/anon key.
3. Confirm the frontend contains no service-role key, secret key, or database password.
4. Test locally over HTTP, including an authenticated sale and receipt.

## Enable deployment

1. Push the repository to GitHub on the `main` or `master` branch. The workflow also supports manual runs.
2. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Open the **Actions** tab. Wait for **Deploy GitHub Pages demo** to complete successfully.
4. Use the URL shown by the workflow (usually `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/`). Add that exact origin/path to Supabase **Authentication → URL Configuration → Redirect URLs**.
5. Open the live URL, sign in with the admin account, and test the workflow below.

Changes to `github-pages-demo/**` or the Pages workflow trigger a new deploy. The site is static; GitHub Pages does not run PHP, Python, MySQL, or server-side code. Auth, data, and storage requests go directly to your Supabase project, protected by Auth and RLS.

## End-to-end smoke test

1. Open the site and sign in as the admin.
2. Open **Inventory**, confirm sample items appear, and add stock to an item.
3. Open **Sales**, add the item and quantity, enter payment details, continue to **Review**, then confirm.
4. Open the receipt and print it. Verify the stock decreased once and the receipt number is present.
5. Open **Sales History** and **Sales Reports**; verify the sale appears. Check inventory reports for the stock change.
6. In **Users**, create a test staff account after deploying the Edge Function. Sign out and confirm that the staff account can perform staff actions but cannot open admin pages.

The app's current receipt output is printed by the browser. The private `receipts` bucket is prepared but not used for receipt uploads. Database exports/backups must be managed through Supabase; GitHub Pages cannot run the original backup/restore scripts.
