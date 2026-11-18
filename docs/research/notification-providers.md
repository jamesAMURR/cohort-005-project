# Hosted notification providers for Cadence

**Question.** Which hosted notification provider best fits Cadence (React Router v7 framework mode with SSR, SQLite/Drizzle, Node)? The provider must offer a live-updating in-app Inbox, web push, email, per-user preferences, and a workable dev/test story, and it must identify recipients by our own user id. The dev panel switches the current user, so the Inbox has to re-identify cleanly.

**Researched:** 2026-11-17. All pricing pages were read on this date. npm versions come from `npm view` on the same date. Pricing changes often, so re-check before deciding.

**Scope.** This document compares the options and does not pick one. The decision is a separate human ticket.

---

## Summary

- **Every primary candidate passes the hard requirements** (hosted, free dev tier, live Inbox, own user id): Knock, Novu Cloud, MagicBell, Courier and SuprSend. All of them push Inbox updates over a persistent socket rather than polling.
- **The main differences** are web push support, preference UI on the free tier, how the Inbox client authenticates, and dev/test isolation.
  - **Web push:** MagicBell and SuprSend support native VAPID web push with a drop-in SDK. Knock and Novu route it through FCM. Courier points to OneSignal or Pusher Beams.
  - **Free-tier preferences:** SuprSend gates all preference features behind the $250/mo Business plan.
  - **Inbox auth:**
    - Knock uses an RS256 JWT, with public-key-only access allowed in dev.
    - Novu uses an HMAC-SHA256 of the subscriber id.
    - MagicBell uses an HS256 user JWT.
    - Courier always requires a backend-minted JWT.
    - SuprSend uses an ES256 JWT, with public-key-only access when enhanced security is off.
  - **Dev/test:** Knock, Courier and SuprSend give separate environments plus a test email sink. Novu has 2 environments and a local tunnel CLI. MagicBell's free tier is a single project.
- **Excluded:**
  - Engagespot: the pricing page returns 404 and the npm SDKs are stale.
  - Pingram (formerly NotificationAPI): the pricing page now covers only SMS, voice and email, with no in-app product listed.
  - Inngest: a workflow engine, not a notification provider.

## Comparison table

| | Knock | Novu Cloud | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| Inbox live updates | WebSocket [K3] | WebSocket (PartySocket on cloud) [N3][N4] | WebSocket [M4] | WebSocket, after `listenForUpdates()` [C2] | Socket (socket.io per README) [S7] |
| Web push | Via FCM only; "no first-party web push channel" [K6] | FCM / OneSignal / Pushpad / Pusher Beams; browser setup not documented on overview [N6] | Native VAPID + `WebPushButton` + `/sw.js` [M3][M5] | OneSignal (browser) or Pusher Beams web mode [C5] | Native VAPID, `serviceworker.js`, `vapidKey` prop [S8] |
| Email | Bring your own ESP (Resend, SendGrid, SES, Postmark…); "Knock (testing only)" provider + sandbox mode [K7] | Bring your own ESP (19 incl. Resend/SES/SendGrid); demo email 300/mo to your login address only [N7][N8] | Bring your own ESP (SMTP, SendGrid, Mailgun, SES, Ping); Resend not listed [M8] | Bring your own ESP (Resend, SendGrid, SES, Postmark…); Test env has testing email to signup address [C6][C7] | Bring your own ESP (Resend, SendGrid, SES…); Sandbox workspace has built-in vendors [S10] |
| Free tier | 10k messages/mo; unlimited environments [K1] | 10k workflow runs/mo, 5 workflows, 2 envs [N1][N9] | 1,000 deliveries/mo (per channel), 1 project [M1] | 10k sends/mo [C1] | 10k notifications/mo, branded inbox, **no preferences** [S1] |
| Next paid tier | Starter $250/mo (50k msgs) [K1] | Pro from $30/mo (30k runs) [N1] | Startup $249/mo (50k) [M1] | Business $0.005/send pay-as-you-go [C1] | Essentials $100/mo (50k), but preferences need Business $250/mo [S1] |
| React SDK | `@knocklabs/react` 0.15.1, prebuilt + hooks, peer React ^17/18/19 [K2][npm] | `@novu/react` 3.20.0, `<Inbox>` + hooks, peer React ^18/^19 [N2][N5][npm] | `@magicbell/react` 1.14.0, prebuilt (no hooks documented) [M2][npm] | `@trycourier/courier-react` 9.3.5, prebuilt + `useCourier`, React >=18, client-only [C3][npm] | `@suprsend/react` 1.6.0, drop-in + headless [S5][S6][npm] |
| Inbox client auth | Public key + `userId`; prod: RS256 signed user token (enhanced security) [K4] | `applicationIdentifier` + `subscriberId`; HMAC-SHA256 `subscriberHash` when enabled [N10] | HS256 user JWT (external id + API key), signed with secret [M6][M7] | Always a backend-minted JWT via `POST /auth/issue-token` [C4] | Public key + `distinctId`; ES256 JWT when enhanced security on [S3][S4] |
| Node SDK | `@knocklabs/node` 1.41.1 | `@novu/api` 3.20.0 (`@novu/node` 2.6.6 legacy) | `magicbell-js` 1.8.0 (`/project-client`) [M4] | `@trycourier/courier` 10.0.1 | `@suprsend/node-sdk` 1.15.1 |
| Preferences | Channel / category / workflow `PreferenceSet`; `usePreferences` hook; hosted preference center [K8][K9] | Global per channel + per workflow per channel; built into prebuilt `<Inbox>`; critical workflows [N11][N12] | Category × channel; `UserPreferences` component [M2][M9] | `<CourierPreferences />` topic preference center [C3] | Channel + category; prebuilt + hosted page, **Business plan only** [S1] |
| Environments / testing | Dev + prod + custom envs, per-env keys, CLI, branches [K5] | 2 envs on free, `npx novu dev` local tunnel [N9][N13] | Not documented; free = 1 project [M1] | Test + Production envs; Mock keys Enterprise-only [C7] | Sandbox / Staging / Production workspaces; Test Mode in staging [S9] |

`[npm]` = `npm view <pkg> version peerDependencies` run on 2026-11-17.

---

## Knock

- **Live updates.** The feed client connects to Knock's real-time service. It "receives notifications over a websocket when new messages are sent to an in-app feed channel." [K3]
- **Web push.** "Knock does not have a first-party web push channel. Instead, you'll use FCM to send messages to a user's browser." [K6]
  - You need a `firebase-messaging-sw.js` service worker and Firebase `getToken` with a VAPID key.
  - You store the token with `knock.user.setChannelData`. [K6]
  - Knock's push integrations list only names FCM for Android. [K10]
- **Email.** Bring your own ESP. Resend, SendGrid, SES, Postmark, SMTP and others are supported. [K7]
  - A "Knock (testing only)" provider and an email sandbox mode exist for development. [K7]
- **Free tier** (read 2026-11-17). [K1]
  - $0/mo for up to 10,000 messages a month, unlimited environments and 30-day logs.
  - Knock branding is not removable on free.
  - Starter is $250/mo for 50k messages, then $0.005 each.
  - Unverified: whether each in-app feed item counts as a "message" toward the 10k.
- **React SDK.**
  - `@knocklabs/react` (0.15.1, peer React `^17 || ^18 || ^19`), plus `@knocklabs/client` (0.23.1). [K2][npm]
  - Prebuilt components are `NotificationFeedPopover`, `NotificationFeed` and `NotificationIconButton`. It can also be used "in a headless way" with hooks. [K2]
  - Setup is `<KnockProvider apiKey user={{ id }}>` wrapping `<KnockFeedProvider feedId userToken>`. [K11]
  - No SSR or React Router notes were found in the docs (unverified).
- **Identification and auth.** [K4]
  - The client authenticates with the public key and our user id.
  - Enhanced security mode is off by default, and docs say to enable it before release. When on, requests need an RS256 user token signed with the environment's private signing key (`sub` = user id). The signer is `signUserToken` from `@knocklabs/node`.
  - Development environments can run with "only your public key."
  - "Calling `authenticate` again with a new token restarts the real-time connection." That gives a clean path for dev-panel user switching.
- **Node SDK.** `@knocklabs/node` 1.41.1. [npm]
- **Preferences.** [K8][K9]
  - A `PreferenceSet` covers channels, categories and workflows.
  - There is a hosted no-code preference center, and `usePreferences` is available for custom UI. Docs build the React preference center yourself; no prebuilt component was confirmed.
  - Preferences are included on Free. [K1]
- **Testing and dev.** [K5]
  - Development and production environments, plus optional custom ones, each with its own data and API key pair.
  - Content is promoted from dev to prod. The Knock CLI takes an `--environment` flag, and branches are available.
  - Tests avoid real calls by using the dev environment and the testing email provider. No official mock or offline mode was found (unverified).

## Novu Cloud

- **Live updates.** "The Novu client provides real-time event handling through WebSocket connections." [N3]
  - The `useNotifications` and `useCounts` hooks update in real time. [N5]
  - A Novu PR describes cloud using PartySocket and self-hosted using socket.io. [N4]
- **Web push.** Supported push providers are FCM, Expo, APNs, OneSignal, Push Webhook, Pusher Beams and Pushpad. [N6]
  - The overview suggests a separate FCM integration "for web app" but gives no browser setup steps.
  - Unverified: the exact service-worker flow for browser push through Novu.
- **Email.** Bring your own ESP, with 19 providers including Resend, SendGrid and SES. [N7]
  - The demo email integration allows 300 a month, delivers only to your Novu login address, and is cloud-only. [N8]
- **Free tier** (read 2026-11-17). [N1][N9]
  - 10k workflow runs a month, 5 workflows, 2 environments, 3 team members, 30-day Inbox retention and 24h activity retention.
  - All channels are included.
  - Pro is from $30/mo for 30k runs, then $1.20 per 1k.
- **React SDK.**
  - `@novu/react` 3.20.0, peer React `^18 || ^19`. [npm]
  - The prebuilt `<Inbox applicationIdentifier subscriberId routerPush>` lets navigation go through React Router. [N2]
  - Headless use goes through `NovuProvider` with `useNotifications`, `useCounts`, `useNovu` and `usePreferences`. [N5]
  - No SSR notes were found (unverified).
- **Identification and auth.** [N2][N10]
  - `subscriberId` is our DB user id, auto-created on first use.
  - With the per-environment "Security HMAC encryption" toggle on, the Inbox needs `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` computed server-side. "If HMAC encryption is active … and `subscriberHash` is not provided, the Inbox will not load."
  - Unverified: how the client behaves when `subscriberId` changes at runtime. Remounting the Inbox per user is the likely approach.
- **Node SDK.** `@novu/api` 3.20.0 is the current one. `@novu/node` 2.6.6 is legacy and was last published in 2025-12. [npm]
- **Preferences.** [N11][N12]
  - The prebuilt Inbox includes a preferences view with global per-channel toggles and per-workflow per-channel toggles. A per-workflow choice overrides the global one.
  - Workflows marked critical cannot be disabled.
- **Testing and dev.** [N9][N13]
  - 2 environments on free, Development and Production.
  - `npx novu dev` opens a local tunnel and a "Local" environment in the dashboard for code-first workflows. Tunnel URLs are refused in production.
  - No official mock mode was found (unverified).

## MagicBell

- **Live updates.** "The Realtime client enables real-time notification delivery through WebSocket connections." [M4]
  - `@magicbell/react` depends on `reconnecting-websocket`. [npm]
  - The in-app docs say the Inbox updates "without requiring a page refresh." [M10]
- **Web push.** Native VAPID web push. [M3][M5]
  - You configure a VAPID key pair, and tokens are `PushSubscription` endpoints plus p256dh/auth keys.
  - The React `WebPushButton` subscribes the user and needs a service worker that loads MagicBell's script (default `/sw.js`).
- **Email.** Bring your own ESP. Docs list SMTP, SendGrid, Ping Email, Mailgun and SES. [M8]
  - Resend is not listed (unverified, and possibly usable via SMTP).
- **Free tier** (read 2026-11-17). [M1]
  - Builder is $0 for 1,000 deliveries a month and 1 project. A delivery counts once per channel.
  - Startup is $249/mo for 50k deliveries, then $0.0025 each.
  - The free tier is the smallest of the five. With in-app plus email, every notification counts twice.
- **React SDK.**
  - `@magicbell/react` 1.14.0, last published 2026-07-29. npm declares no React peer range. [npm]
  - Components are `Provider token`, `FloatingInbox`, `Inbox`, `InlineNotification`, `WebPushButton`, `UserPreferences` and `ToastContainer`. [M2]
  - Headless hooks are not documented for the new package. The older `@magicbell/react-headless` 5.5.1 exists (peer React >=18.3.1). No SSR notes were found.
- **Identification and auth.**
  - Users are identified by `external_id`, typically our user id. [M6]
  - User tokens are "generated on your backend using the Secret Key and the API Key." [M11]
  - MagicBell's own blog example signs HS256 with `user_external_id` and `api_key` claims. [M7] The claim list in the official reference is unverified.
  - Unverified: whether a dev mode skips the JWT, and how user switching works. Changing the `token` prop on the Provider is the likely approach.
- **Node SDK.** `magicbell-js` 1.8.0 (`magicbell-js/project-client`). [M4][npm]
- **Preferences.** The model is category × channel, read and written through `/channels/user_preferences`. A prebuilt `UserPreferences` component exists. [M2][M9]
- **Testing and dev.** No environments or test mode were documented. The free tier allows 1 project, and extra projects are $99 on Startup. [M1] This is the weakest dev/test story of the five.

## Courier

- **Live updates.** You must call `inbox.listenForUpdates()` after sign-in. Without it, "the inbox loads once and does not update." [C3] It "opens the WebSocket connection required for real-time updates." [C2]
- **Web push.** Push providers are FCM, APNs, Expo, OneSignal, SNS, Pusher Beams and others. [C5]
  - Courier's guide recommends OneSignal for browser push, and Pusher Beams has a `web` mode.
  - There is no native VAPID channel, which adds a third-party push vendor.
- **Email.** Bring your own ESP: Resend, SendGrid, SES, Postmark and others, with failover. [C6]
  - A new Test environment includes a testing email provider that only delivers to the signup address. [C7]
- **Free tier** (read 2026-11-17). [C1]
  - Developer is free for 10,000 sends a month.
  - Business is pay-as-you-go at $0.005 per send.
  - Unverified: which plan includes Inbox and Preferences, because the pricing page does not say per plan.
- **React SDK.** `@trycourier/courier-react` 9.3.5 (React >=18). [npm][C3]
  - Components are `<CourierInbox>`, `<CourierInboxPopupMenu>`, `<CourierToast>` and `<CourierPreferences>`. The `useCourier` hook gives headless access.
  - The components "render client-side only," and Next.js needs `'use client'`. Cadence would need a client-only boundary.
  - React 19 is not named in the docs. The peer range `>=18` allows it.
- **Identification and auth.** [C4]
  - Sign-in is `signIn({ userId, jwt })`. The JWT always comes from the backend via `POST /auth/issue-token` with scopes like `user_id:<id> inbox:read:messages inbox:write:events` and `expires_in`.
  - The SDK does not refresh tokens. `signOut` disconnects the socket, so switching users means `signOut` then `signIn`.
  - No public-key-only dev mode is documented, so even local dev needs a token endpoint.
- **Node SDK.** `@trycourier/courier` 10.0.1. [npm]
- **Preferences.** The preference center is topic-based (`<CourierPreferences />`). [C3] Unverified: whether it is per channel per topic.
- **Testing and dev.** [C7]
  - Every workspace has Production and Test environments with separate keys.
  - Draft keys preview templates.
  - Mock keys, which simulate delivery without calling providers, are Enterprise-only.

## SuprSend

- **Live updates.** `feedClient.initializeSocketConnection()` opens a realtime socket. [S7] The React inbox README says it uses socket.io. [S7] One documentation ticket says the socket disconnects in hidden tabs from web-sdk 5.4.0 (secondary, unverified).
- **Web push.** Native VAPID. [S8]
  - You need a `serviceworker.js` at the domain root that imports SuprSend's worker script, plus the `vapidKey` prop on `SuprSendProvider`.
  - SuprSend holds the private key.
- **Email.** Bring your own ESP (Resend, SendGrid, SES, Mailgun…) in staging and production. The Sandbox workspace has SuprSend's own vendor accounts pre-integrated. [S10]
- **Free tier** (read 2026-11-17). [S1]
  - 10,000 notifications a month, with an embeddable and headless inbox carrying SuprSend branding.
  - **Channel preferences, category preferences, the preference-center UI and the hosted preference page are all "Not included" on Free and Essentials ($100/mo).** They start at Business ($250/mo).
  - "Multiple Environments" is included on all plans.
- **React SDK.**
  - `@suprsend/react` 1.6.0 (peer React >=16.8). `@suprsend/react-inbox` has reached end of support. [S2][npm]
  - Both drop-in components and a headless mode are offered. [S2][S5]
  - No SSR notes were found.
- **Identification and auth.** [S3][S4][S6]
  - `SuprSendProvider publicApiKey distinctId userToken refreshUserToken`.
  - `distinctId={null}` logs the user out. Behaviour when switching directly between ids is not documented.
  - With enhanced security mode on, an ES256 JWT is required, signed with a dashboard signing key and carrying `entity_type: "subscriber"`, `entity_id`, `iat`, `exp` and an optional `scope.tenant_id`.
  - Secondary report: enhanced security is off in Sandbox, so badly signed tokens "work" there and fail in production (unverified in primary docs).
- **Node SDK.** `@suprsend/node-sdk` 1.15.1. [npm]
- **Preferences.** Channel plus category, with a prebuilt and hosted page, on Business and above only. [S1]
- **Testing and dev.** [S9]
  - Sandbox, Staging and Production workspaces with separate keys.
  - Staging has a Test Mode that delivers only to internal testers, plus a catch-all channel.
  - Changes are committed and moved between workspaces with the CLI.

## Excluded candidates

- **Engagespot.** `engagespot.co/pricing` returned 404 on 2026-11-17, and free-tier limits could not be verified. `@engagespot/react-component` was last published 2025-05 and `@engagespot/node` 2024-11. [npm]
- **Pingram (formerly NotificationAPI).** `notificationapi.com/pricing` redirects to `pingram.io/pricing`. That page lists SMS, voice and email budgets only, with in-app and web push not mentioned. [P1] `@notificationapi/react` 2.0.1 still exists. The in-app offering could not be verified from primary sources.
- **Inngest.** A durable workflow and function engine, not a notification Inbox provider, so it does not meet the requirements.

---

## Ranked shortlist (not a decision)

1. **Knock.**
   - **Strengths:**
     - Best dev/test isolation: unlimited environments on free, a testing email provider, a CLI and branches.
     - The cleanest dev-panel story: public-key-only access in dev, and re-`authenticate` restarts the socket.
     - Mature React SDK with declared React 19 support, and preferences included on free.
   - **Trade-offs:**
     - Web push only via FCM (Firebase project and service worker).
     - A steep jump to $250/mo when outgrowing 10k messages.
     - Knock branding on free.
2. **Novu Cloud.**
   - **Strengths:**
     - The prebuilt `<Inbox>` already includes per-workflow and per-channel preferences, plus a `routerPush` hook for React Router.
     - The cheapest paid step ($30/mo).
     - Simple HMAC auth.
     - Very active SDK releases (3.20.0 published 2026-11-16).
   - **Trade-offs:**
     - Free tier caps at 5 workflows and 24h activity logs.
     - Browser push setup is not documented on the overview.
     - The demo email only reaches your own address.
     - Runtime subscriber switching is not documented.
3. **MagicBell.**
   - **Strengths:** The only shortlisted option with native VAPID web push *and* a drop-in `WebPushButton` and preference component.
   - **Trade-offs:**
     - The free tier is 1,000 per-channel deliveries and a single project, with no documented environments or test mode.
     - The JWT claim spec is documented only in a blog post.
   - **Alternative third pick: Courier,** if web push matters less than a polished Inbox. Its downsides are a backend JWT required even in dev and an OneSignal/Beams dependency for browser push.

SuprSend would rank higher on technical fit (native VAPID, Sandbox/Staging/Test Mode). Preferences being gated at $250/mo keeps it off the shortlist.

## Unverified / open items

- Knock: whether in-app feed items count toward the 10k "messages."
- Knock, Novu, MagicBell, SuprSend: no documented SSR or React Router guidance. The Inbox probably needs client-only rendering.
- Novu, MagicBell, SuprSend: exact behaviour when the user id or token prop changes at runtime (dev-panel switching). The likely approach is remounting with `key={userId}`.
- Novu: browser web push setup steps.
- MagicBell: official JWT claim list, Resend support, and any environments/test mode.
- Courier: which plan includes Inbox and Preferences, and whether preferences are per channel.
- SuprSend: "enhanced security off in Sandbox" comes from a secondary source.
- Engagespot and Pingram: current pricing and in-app product status.

---

## Sources

All accessed 2026-11-17.

**Knock**
- [K1] https://knock.app/pricing
- [K2] https://docs.knock.app/in-app-ui/react/overview
- [K3] https://docs.knock.app/in-app-ui/feeds/overview
- [K4] https://docs.knock.app/in-app-ui/security-and-authentication
- [K5] https://docs.knock.app/concepts/environments
- [K6] https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm
- [K7] https://docs.knock.app/integrations/email/overview
- [K8] https://docs.knock.app/concepts/preferences
- [K9] https://docs.knock.app/preferences/custom-preference-center
- [K10] https://docs.knock.app/integrations/push/overview
- [K11] https://docs.knock.app/in-app-ui/react/feed

**Novu**
- [N1] https://novu.co/pricing
- [N2] https://docs.novu.co/platform/quickstart/react
- [N3] https://docs.novu.co/platform/sdks/javascript
- [N4] https://github.com/novuhq/novu/pull/12832
- [N5] https://docs.novu.co/platform/inbox/headless-mode
- [N6] https://docs.novu.co/platform/integrations/push
- [N7] https://docs.novu.co/platform/integrations/email
- [N8] https://docs.novu.co/platform/integrations/demo-integration
- [N9] https://docs.novu.co/platform/developer/limits
- [N10] https://docs.novu.co/platform/inbox/prepare-for-production
- [N11] https://docs.novu.co/platform/inbox/configuration/preferences
- [N12] https://docs.novu.co/platform/concepts/preferences
- [N13] https://docs.novu.co/framework/studio

**MagicBell**
- [M1] https://www.magicbell.com/pricing
- [M2] https://www.magicbell.com/docs/libraries/magicbell-react
- [M3] https://www.magicbell.com/docs/channels/web_push
- [M4] https://www.magicbell.com/docs/libraries/magicbell-js
- [M5] https://www.magicbell.com/docs/libraries/magicbell-react (WebPushButton section)
- [M6] https://www.magicbell.com/docs/primitive/user
- [M7] https://www.magicbell.com/blog/using-push-notifications-in-pwas (vendor blog, not reference docs)
- [M8] https://magicbell.com/docs/email/3rd-party-email-providers
- [M9] https://www.magicbell.com/docs/api/reference
- [M10] https://www.magicbell.com/docs/channels/in_app
- [M11] https://www.magicbell.com/docs/api/authentication

**Courier**
- [C1] https://www.courier.com/pricing
- [C2] https://www.courier.com/docs/platform/inbox/authentication
- [C3] https://www.courier.com/docs/platform/inbox/web/react-sdk
- [C4] https://courier.com/docs/platform/inbox/authentication
- [C5] https://www.courier.com/docs/integrations/push/overview
- [C6] https://www.courier.com/docs/integrations/email/overview
- [C7] https://courier.com/docs/platform/workspaces/environments-api-keys

**SuprSend**
- [S1] https://www.suprsend.com/pricing
- [S2] https://docs.suprsend.com/docs/react-inbox-integration
- [S3] https://docs.suprsend.com/docs/client-authentication
- [S4] https://docs.suprsend.com/docs/inbox-quick-start
- [S5] https://docs.suprsend.com/docs/react-in-app-feed
- [S6] https://docs.suprsend.com/docs/react-sdk
- [S7] https://docs.suprsend.com/docs/js-inapp-feed and https://github.com/suprsend/suprsend-react-inbox
- [S8] https://docs.suprsend.com/docs/react-webpush
- [S9] https://docs.suprsend.com/docs/what-is-suprsend
- [S10] https://docs.suprsend.com/docs/vendors

**Other**
- [P1] https://www.pingram.io/pricing (redirected from https://www.notificationapi.com/pricing)
- [npm] `npm view <package> version time.modified peerDependencies` on 2026-11-17 for every package named above.
