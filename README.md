# নওয়াব লুম — Saree & Lungi Store

Cloudflare Pages + Pages Functions + D1 + private R2-এ deploy করার জন্য responsive e-commerce storefront ও admin console। Storefront-এর premium white look, শাড়ি/লুঙ্গির আলাদা collection, search, product detail ও related items, bag/checkout, payment proof verification, secure admin এবং daily sales PDF source code-এ আছে। `PROJECT_BRIEF.md`-এ requested scope সংরক্ষিত আছে।

## Local preview

Node.js 20+ ব্যবহার করুন:

```sh
npm install
npm run build
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 migrations apply nawab-loom-store --local
npm run pages:dev
```

Cloudflare Pages local preview চালু হবে; `.dev.vars`-এর দুই secret-এ আলাদা random value দিন। `npm run dev` শুধু UI দেখায়—D1/R2 Functions চালায় না। Production/Preview deploy-এর আগে `wrangler.toml`-এর দুই `database_id`-তে আসল D1 IDs বসান:

```sh
npm run build
```

শুধু static storefront build command হলো `npm run build`।

## Cloudflare deploy

1. এই folder-টি GitHub repository root করুন, অথবা parent repository ব্যবহার করলে Cloudflare Pages-এর **Root directory** `outputs/saree-lungi-store` দিন। Build command `npm run build`, output directory `dist`।
2. Production-এর জন্য `nawab-loom-store` D1 database এবং `nawab-loom-payment-proofs` private R2 bucket তৈরি করুন। `wrangler.toml`-এর production `database_id` বসান। PR/branch preview-কে production orders থেকে আলাদা রাখতে `nawab-loom-store-preview` D1 database ও `nawab-loom-payment-proofs-preview` R2 bucket-ও তৈরি করুন এবং `env.preview`-এর database ID বসান। Wrangler config production ও preview-এর binding source of truth।
3. Local terminal থেকে দুই database-এ migration apply করুন:

   ```sh
   npx wrangler d1 migrations apply nawab-loom-store --remote
   npx wrangler d1 migrations apply nawab-loom-store-preview --remote --env preview
   ```

   Private R2 bucket দুটো বানাতে `npx wrangler r2 bucket create nawab-loom-payment-proofs` এবং `npx wrangler r2 bucket create nawab-loom-payment-proofs-preview` চালান।

4. Pages project-এর production ও preview settings-এ `DB` এবং `PROOFS` bindings যাচাই করুন। Wrangler config file Pages-এর production/preview configuration source হিসেবে ব্যবহার হয়; production ও preview resources আলাদা থাকা নিশ্চিত করুন।
5. Cloudflare Pages → Settings → Variables and Secrets-এ Production এবং Preview-এর জন্য আলাদা encrypted `ADMIN_BOOTSTRAP_KEY` ও `ADMIN_SESSION_SECRET` দিন। প্রতিটি value লম্বা random secret হবে; source code/GitHub-এ রাখবেন না। PowerShell-এ random value বানাতে:

   ```powershell
   [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

   আলাদা secret বানিয়ে `ADMIN_BOOTSTRAP_KEY` ও `ADMIN_SESSION_SECRET` হিসেবে save করুন। Production ও Preview—দুই environment-এই secret set করুন।
6. Cloudflare Pages-এ deploy করুন। Live site-এ `/#admin` খুলে bootstrap key দিয়ে প্রথম admin email/password তৈরি করুন। Password অন্তত 12 অক্ষরের হতে হবে। Account তৈরি হলে bootstrap endpoint বন্ধ হয়ে যায়।
7. Admin → Store settings-এ brand/contact/social link, delivery fee, bKash/Nagad/Rocket নম্বর ও card payment link বসান। Admin → Products-এ sample catalog-কে real product name, ছবি URL, price ও stock দিয়ে বদলান।

## Payments and order confirmation

COD order সরাসরি `pending` হিসেবে জমা হয়; admin পরে processing, shipped, delivered বা cancelled করতে পারেন। bKash/Nagad/Rocket/Card-এ customer merchant instructions মেনে payment করে transaction/reference code ও সর্বোচ্চ 5 MB-এর JPG/PNG/WebP screenshot দেয়। Screenshot private R2-তে থাকে; non-COD order `awaiting_payment_review` হয় এবং admin proof দেখে verify না করা পর্যন্ত confirmed হয় না। Admin payment reject বা order cancel করলে stock ফেরত যোগ হয়।

এটি merchant gateway-এর automatic card/wallet charge করে না। Card option secure external payment link + manual proof review সমর্থন করে। Automatic checkout/verification চালু করতে merchant gateway account, live API credentials এবং webhook/domain verification আলাদা করে configure করতে হবে। Credentials এলে gateway integration আলাদা release-এ যোগ করতে হবে।

## Admin reports

Demand report-এ নির্বাচিত Dhaka-local date অনুযায়ী order count, net sales, best selling product এবং cancelled/rejected products দেখা যায়। PDF-এ Bengali text বজায় রাখতে browser-rendered report image PDF হিসেবে export হয়।

## Security and launch checklist

- Cloudflare HTTPS বাধ্যতামূলক; first-admin secrets set করুন।
- `#admin` account-এর default password নেই—first-run setup secret আবশ্যক।
- Payment proofs private R2 bucket-এ রাখা হয়; customer API থেকে proof file প্রকাশ করা হয় না।
- Launch-এর আগে demonstration products বদলান, merchant payment numbers/card URL দিন, store email/phone/social links দিন, delivery fee ঠিক করুন, এবং Cloudflare-এ login endpoint-এর জন্য rate limiting rule দিন।
- Customer data order delivery-র জন্য সংরক্ষণ হয়; deploy-এর আগে আপনার privacy/return/delivery policy যোগ করুন।
