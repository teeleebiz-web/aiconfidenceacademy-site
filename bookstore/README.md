# ACA bookstore backend

This module is independent of Academy enrollment and curriculum. The storefront remains at https://aiconfidenceacademy.org/library/.

## Foundation

Six dedicated tables hold titles, editions, files, orders, access, and the email outbox. The private `aca-bookstore-files` bucket starts with a conservative 50 MB per file limit. Larger audiobook packages require confirmed project upload capacity before increasing this bucket's limit. No customer files or prices are seeded.

The API routes are under `https://checkout.aiconfidenceacademy.org/api/bookstore/`: GET `status`, POST `checkout`, GET `purchases`, POST `download`, and POST `webhook`. Checkout, purchase history, and downloads authenticate a Supabase Bearer token through `getUser`. Download access requires a paid bookstore order for that buyer and environment; its signed link lasts five minutes.

Checkout is closed by default. `ACA_BOOKSTORE_SALES_ENABLED=true` and a dedicated `ACA_BOOKSTORE_WEBHOOK_SECRET` are required. Existing Stripe and Supabase server credentials are reused within the backend. Do not change the enrollment webhook or existing installment test callback.

Fulfillment verifies the Checkout session, payment status, environment, selected Stripe price, quantity, and order totals. A database transaction locks the order and atomically records payment, access, and a pending delivery email. Duplicate notifications do not add duplicate grants or outbox rows. Failed or unpaid sessions cannot grant access.

## Required before opening sales

1. Approve and upload the first complete ebook or audiobook edition, cover, sample, price, and refund terms.
2. Complete the buyer sign-in and purchases page and the email outbox delivery worker. The current success URL returns to the catalog; it is not a completed customer delivery screen.
3. Add full refund access revocation and customer support recovery before opening live sales. Downloads already reject orders marked refunded.
4. Configure a separate sandbox book webhook for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and then verify purchase, delivered email, authorized download, duplicates, declines, and refunds. Do not set the sales flag before this acceptance gate.
5. Enable production only after a controlled live verification of the approved first product.

The code and database foundation are not a claim that the complete customer purchase flow has passed.

## Checks

Run `node --test bookstore/service.test.mjs`. Database transaction checks verify duplicate fulfillment, amount mismatch rejection, one grant and outbox row, RLS, and absence of public storage access with fixtures rolled back afterward.
