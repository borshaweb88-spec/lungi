# Store requirements and implementation notes

## Storefront
- Premium white editorial storefront for a saree and lungi retailer.
- Separate Saree and Lungi categories, product search, product bag/cart, and an About the Store section.
- Contact rail with WhatsApp, Facebook, Instagram, and click-to-call links.
- Product detail view with description, quantity, order form, and related products.
- Customer checkout collects name, phone, email, full address, quantity, and payment choice.
- Payment methods: Cash on Delivery, bKash, Nagad, Rocket, credit/debit card. Non-COD orders require a transaction/reference code and payment screenshot; remain unconfirmed until an admin verifies the proof.

## Admin
- Secure first-admin bootstrap and sign-in, configurable store contact/payment details, product/category editing, order cancellation and payment-proof review.
- Demand report shows top ordered/sold items and rejected/cancelled items.
- Daily order summary can be exported to PDF.
- Admin email and password can be changed after authenticating with the current password.

## Deployment assumptions
- Cloudflare Pages hosts the static storefront and Pages Functions API.
- Cloudflare D1 stores catalog, settings, orders, and admin accounts. Cloudflare R2 privately stores payment proof screenshots.
- Payment accounts and contact/social links must be set by the store owner in Admin Settings. Card/mobile wallet transfers are collected as proof and manually verified in this implementation; automated card/bKash/Nagad/Rocket checkout requires a merchant gateway contract and credentials.
- The initial catalog contains demonstration entries that should be replaced with the store's real products and photos before launch.
