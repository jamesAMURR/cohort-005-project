# What happens when a web push token stops working

Research for [#20 How do Knock and FCM handle revoked push permission and expired tokens?](https://github.com/jamesAMURR/cohort-005-project/issues/20), part of the map [#2 In-app Notifications for Cadence](https://github.com/jamesAMURR/cohort-005-project/issues/2). Researched 2026-11-21. It builds on [`research/web-push-without-native-app`](https://github.com/jamesAMURR/cohort-005-project/blob/research/web-push-without-native-app/docs/research/web-push-without-native-app.md) and does not repeat it.

This file lists facts only. What Cadence does about dead tokens is decided in [#21 Does Cadence notice when push stops reaching someone, and what does it do?](https://github.com/jamesAMURR/cohort-005-project/issues/21).

Statements marked **Not documented** are gaps in the primary sources. Statements marked **Inference** are reasoning from the cited facts and have not been confirmed by a test.

## Short answer

- **FCM's answer for a dead token:** HTTP v1 returns `UNREGISTERED` (HTTP 404). Firebase says it is then safe to delete the token. `INVALID_ARGUMENT` (400) can also mean a bad token, but it is also returned for payload errors.
- **Knock cleans up by itself, by default.** "Token deregistration" is a per-environment toggle on the FCM channel and defaults to ON for new channels. When a push bounces because of a bad token, Knock removes that token from the person's channel data and emits a `message.bounced` webhook that carries the token. There is no webhook for "token removed" and no "delivered" status for push.
- **The page can always see the current permission** with `Notification.permission` (or `getToken()` throwing). It can't reliably be *told* about a revocation: the Permissions API `change` event never fires in Safari, and Chrome does not fire `pushsubscriptionchange` on revocation.
- **Token lifetime:** Firebase treats a token as stale after one month without contact and recommends refreshing about monthly. The Firebase JS SDK refreshes its web token itself when `getToken()` is called on a token older than 7 days. The 270-day expiry in Firebase's docs is stated for Android only. No web-specific expiry is documented.

## 1. What FCM HTTP v1 returns for a dead token

| Error | HTTP | Firebase's description |
| --- | --- | --- |
| `UNREGISTERED` | 404 | "App instance was unregistered from FCM. This usually means that the token used is no longer valid and a new one must be used." |
| `INVALID_ARGUMENT` | 400 | "Request parameters were invalid." Comes with a `google.rpc.BadRequest` naming the bad field. |
| `SENDER_ID_MISMATCH` | 403 | "The authenticated sender ID is different from the sender ID for the registration token." |

Source: [FCM v1 ErrorCode reference](https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode).

- Firebase lists `UNREGISTERED` (404) and `INVALID_ARGUMENT` (400) as the responses that can mean a registration is invalid or expired. `INVALID_ARGUMENT` "can also be returned in cases of issues in the message payload", so it only signals a bad token when the payload is known to be valid. If either comes back for a valid payload, "it is safe to delete your record of this registration, since it will never again be valid" ([Firebase, Manage FCM registration tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)).
- Stale tokens may still be accepted: sends to stale registrations "are unlikely to ever be delivered", while expired Android registrations are rejected outright ([Manage tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)). **Not documented:** whether FCM answers `UNREGISTERED` for a stale *web* token or accepts the send and drops it.
- Underneath FCM, each browser has its own push service. The Web Push protocol says a push service "MUST return a 404 (Not Found)" for an expired subscription ([RFC 8030 §7.3](https://datatracker.ietf.org/doc/html/rfc8030#section-7.3)). Apple's web push service returns 410 "The device token has expired" ([Apple, Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). **Not documented:** how FCM maps a Safari (APNs) or Firefox (autopush) 404/410 onto its own response. Firebase's docs don't say whether this surfaces as `UNREGISTERED` synchronously.

## 2. What Knock does with a dead token

### Token deregistration (automatic removal)

- Knock offers "an opt-in, provider-agnostic token management capability known as token deregistration". It "removes invalid tokens (and devices, when using device metadata) from a recipient's corresponding channel data if that token results in a bounced message on send" ([Knock, Token deregistration](https://docs.knock.app/integrations/push/token-deregistration)).
- **Default:** "Token deregistration will default to `ON` when you first create a channel." It is set per environment under the channel's **Advanced** settings, can't be overridden per workflow, and works for FCM ([Token deregistration](https://docs.knock.app/integrations/push/token-deregistration)). The FCM channel's settings list it as "Token deregistration: Whether to enable Knock token deregistration" ([Knock, FCM](https://docs.knock.app/integrations/push/firebase)).
  - The FCM page still describes it as "opt-in". The deregistration page says it defaults to ON. The two can both be true (opt-in feature, pre-ticked). **Check the toggle in both Development and Production** for Cadence's FCM channel rather than assume.
- **How it works:** "any errors caused by invalid or expired tokens result in a bounce. This generates a `message.bounced` event containing the invalid token", and Knock removes the token ([Token deregistration](https://docs.knock.app/integrations/push/token-deregistration)).
- Knock's FCM page lists the FCM errors you'll see in delivery logs: `UNREGISTERED` "The device token provided is not valid and should be removed from the recipients channel data", and `INVALID_ARGUMENT` "The device token given may be incorrect" ([Knock, FCM](https://docs.knock.app/integrations/push/firebase)). **Not documented:** an explicit statement that `UNREGISTERED` (or `INVALID_ARGUMENT`) is the error that Knock classifies as a bounce. That is the obvious reading, but the docs don't spell out the mapping.
- **With the toggle off**, the responsibility is Cadence's: "Knock stores channel data for you but makes no assumptions about whether the stored channel data is valid… if a push token expires, it's your responsibility to omit/update that token for future notifications" ([Knock, Setting channel data](https://docs.knock.app/managing-recipients/setting-channel-data)).

### One send per token

- "If you use multiple device tokens for a single user or object, Knock will generate and try to deliver a notification for each unique token" ([Knock, FCM](https://docs.knock.app/integrations/push/firebase)). So one dead browser among several does not block the others.
- **Not documented:** whether each token gets its own Knock message (own id and status) or the statuses are combined.

### Message statuses

From [Knock, Message statuses](https://docs.knock.app/send-notifications/message-statuses) and [Delivering notifications](https://docs.knock.app/send-notifications/delivering-notifications):

- **Sent:** "Your message has successfully made it from Knock to the delivery provider."
- **Delivered:** "We do not support delivery tracking for push channels", so a push never goes past `sent`. The app can mark it delivered itself using the `knock_message_id` in the push payload.
- **Delivery attempted:** an attempt failed and may be retried. Sends are retried up to 8 times over 30 minutes for connection errors, rate limits and similar.
- **Undelivered:** "we encountered an error, and we will not retry delivery."
- **Bounced:** "the message was dropped by your provider due to bad recipient data, resulting in a bounce." Not retried.
- **Not sent:** only documented for a channel in sandbox mode.

### Outbound webhooks

From [Knock, Outbound webhook event types](https://docs.knock.app/developer-tools/outbound-webhooks/event-types):

- `message.bounced`: "Occurs when a message delivery attempt fails due to bounce." Not retried. `event_data` has `failure_reason`, `failure_details` and **`token`** (push only).
- `message.undelivered`: "Occurs when a message delivery attempt fails permanently." `event_data` has `failure_reason` (`fatal_error` or `retries_exhausted`) and provider-specific `failure_details`. No token.
- `message.delivery_attempted`: a failed attempt that may be retried.
- There is **no event** for channel data changes, token removal or user updates. The only signal that Knock has removed a token is the `message.bounced` event for the send that failed.

### When the list ends up empty

- "The channel step will be skipped during a workflow run if the required `channel_data` is not stored on the recipient" ([Setting channel data](https://docs.knock.app/managing-recipients/setting-channel-data)).
- Knock's own web push tutorial removes a browser by overwriting the FCM channel data "to an empty array", "so that any FCM channel steps they encounter during workflows will be skipped" ([Knock, Sending web push notifications with FCM](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)).
- **Not documented:** whether a skipped push step leaves any message record or event. **Inference:** a person whose last token has been deregistered stops getting push without any further webhook. The bounce for their last token is the last signal.

### Interaction with `setChannelData`

- "The channel data will always be overwritten with each `set` call" ([Setting channel data](https://docs.knock.app/managing-recipients/setting-channel-data)).
- **Inference:** Cadence's read-modify-write (`getChannelData`, change the list, `setChannelData`) can race with Knock's deregistration. If Knock removes a dead token between Cadence's read and write, Cadence writes it back. The next send to it bounces again and Knock removes it again, so the cost is one extra bounce, not a permanent dead token. Knock doesn't document any compare-and-set or append-only API for tokens.

## 3. What happens in the browser in each case

### Permission revoked

- **Spec:** on revocation "the user agent MUST deactivate the affected subscriptions", and it "MAY fire" `pushsubscriptionchange` ([W3C Push API](https://w3c.github.io/push-api/)). Messages to a deactivated subscription "MUST NOT be delivered".
- **Chrome (source):** `PushMessagingServiceImpl::OnContentSettingChanged` unsubscribes every subscription for the origin with reason `PERMISSION_REVOKED`. It deletes the local state, then asks the FCM/GCM servers to delete the instance ID. The source notes that if that network call fails, "as long as messages keep getting sent to it, the unsubscription should eventually reach GCM servers" ([push_messaging_service_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/push_messaging/push_messaging_service_impl.cc)). Chrome's automatic revocations for abusive or disruptive sites go through the same unsubscribe path with their own reasons.
- **Chrome does not fire `pushsubscriptionchange` on revocation.** The flag `kPushSubscriptionChangeEventOnInvalidation` ("for subscription refreshes, revoked permissions or subscription losses") is `FEATURE_DISABLED_BY_DEFAULT`. `kPushSubscriptionChangeEventOnResubscribe` is `FEATURE_ENABLED_BY_DEFAULT` ([content_features.cc](https://chromium.googlesource.com/chromium/src/+/main/content/public/common/content_features.cc)). The Chrome 138 Intent to Ship says the event fires when an origin whose subscription "was revoked because of a permission change" "is re-granted notification permission", with empty `oldSubscription` and `newSubscription` ([blink-dev Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/_ckNx_SZIjc)).
- **Safari macOS:** Apple says Safari revokes push permission if a push doesn't show a notification ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [WebKit, Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)). **Not documented:** what Safari does to the subscription, or which events it fires, when the user turns notifications off in Safari settings.
- **iOS Home Screen app:** the user manages permission "per web app in Notifications Settings — just like any other app" ([WebKit, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). **Not documented:** whether turning it off there deletes the subscription or only hides notifications.
- **Inference (end to end, Chrome):** after revocation the FCM token is dead at Google's side, so Knock's next send gets `UNREGISTERED`, bounces, and (with deregistration on) the token is removed. Not confirmed by a test.

### Site data cleared

- **Spec:** a push subscription belongs to a service worker registration, and "is removed when service worker registration is cleared" ([W3C Push API](https://w3c.github.io/push-api/)).
- **Chrome (source):** `DidDeleteServiceWorkerRegistration` unsubscribes with reason `SERVICE_WORKER_UNREGISTERED`, and `DidDeleteServiceWorkerDatabase` does the same for every subscription. Both go through the same server-side delete as revocation ([push_messaging_service_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/push_messaging/push_messaging_service_impl.cc)).
- Clearing site data also clears the IndexedDB where the Firebase SDK keeps its token, and the `localStorage` note from [#13](https://github.com/jamesAMURR/cohort-005-project/issues/13). Permission itself usually survives in Chrome (it's a site setting, not site data). **Inference:** on the next visit `getToken()` finds no stored token and no subscription, subscribes again and returns a *new* token. Cadence's silent re-filing adds it, and the old one is left in Knock until a send bounces.
- **Safari is different:** WebKit says that on Safari, removing a root-scoped service worker registration "will not affect the associated push subscription" (said in the context of Declarative Web Push), and ITP deletes all website data, including service worker registrations, for sites not visited in a while ([WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)). **Not documented:** whether Safari's "Remove website data" kills the APNs-side subscription.

### Token expires or rotates

- **FCM:** "By default, FCM considers a registration to be stale if its app instance hasn't connected for a month." "For Android, when a registration has been inactive for 270 days, FCM considers it expired and garbage collects it." The 270-day rule is stated for Android only. Firebase recommends saving each token "alongside a timestamp", updating it on every upload, and pruning tokens past the staleness window. Refreshing "once per month strikes a good balance"; "There is no benefit to doing the refresh more frequently than weekly" ([Manage tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)). **Not documented:** a web-specific expiry.
- **Firebase JS SDK `getToken()`** (source, `@firebase/messaging` `main`, [token-manager.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/messaging/src/internals/token-manager.ts)):
  - `TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days`. If the stored token is older, `getToken()` calls `updateToken`, which may return a **different** token string and stores it.
  - If the stored token's VAPID key, endpoint, `auth` or `p256dh` no longer match the browser's current subscription, it deletes the old token at FCM and gets a new one.
  - If there's no push subscription, it creates one with `pushManager.subscribe()`.
  - On the page, when `Notification.permission` is `default` it calls `requestPermission()`, and when it is anything but `granted` it throws `messaging/permission-blocked` ([getToken.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/messaging/src/api/getToken.ts)). So Cadence must check permission itself before calling `getToken()`, or the silent re-filing would open a prompt.
  - These refreshes only happen when something calls `getToken()`. The SDK has no timer.
- **Firebase's service worker on `pushsubscriptionchange`** (source, `@firebase/messaging` 0.13.3, [sw-listeners.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/messaging/src/listeners/sw-listeners.ts)): if the event has no `newSubscription`, the SDK revokes the registration (deletes the token at FCM). Otherwise it deletes the old token and fetches a new one. In the legacy `getToken()` path it **does not tell the page or any server** about the new token; only the newer FID `register()` path posts a message to visible windows. The Firebase client docs say `onRegistered` fires on "A `pushsubscriptionchange` event" ([Firebase, Receive messages in web apps](https://firebase.google.com/docs/cloud-messaging/js/client)), which applies to the `register()` API, not to `getToken()`.
  - Chrome's re-grant event has empty `oldSubscription` and `newSubscription`, and Firefox's event never has those properties ([BCD](#browser-support)). So in both, Firebase's handler treats every `pushsubscriptionchange` as a revocation and deletes its token. **Inference:** the next `getToken()` on a page then makes a new token, which Cadence's silent re-filing picks up.
- **Inference:** a rotated token reaches Knock only when the person next opens Cadence in that browser. Between the rotation and that visit, the old token in Knock is dead (Firebase deleted it), so sends bounce and Knock removes it, and that browser gets no push until the visit.

### iOS Home Screen app removed

- Every iOS web push subscription is tied to a Home Screen web app ("web clip"). WebKit's push daemon removes subscriptions for web clips that no longer exist: first at daemon startup ([WebKit commit 282260@main, bug 277993](https://github.com/WebKit/WebKit/pull/32086), Aug 2024: "On iOS, every web push subscription must be associated with a web clip… remove any subscriptions that are no longer associated with a web clip identifier"), then "on every IPC and also before firing push events" ([WebKit commit 282583@main, bug 278367](https://github.com/WebKit/WebKit/pull/32439), Aug 2024).
- **Not documented:** whether that local removal also unsubscribes at Apple's push service, so that a later send returns 410 (and FCM returns `UNREGISTERED`), or whether sends keep being accepted and are dropped on the device. If the latter, Knock never sees a bounce and the token stays in Knock indefinitely. Firebase's staleness guidance (prune tokens not refreshed in a month) is the documented way to catch this case.
- `pushsubscriptionchange` is not supported on iOS at all (BCD `safari_ios: false`), so an installed app can't learn about a subscription change from its service worker.

## 4. Can a page detect revocation itself?

### Browser support

From MDN browser-compat-data 8.1.10 (`@mdn/browser-compat-data`, data timestamp 2026-11-19), [PermissionStatus `change`](https://developer.mozilla.org/docs/Web/API/PermissionStatus/change_event), [`pushsubscriptionchange`](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event), [`Permissions.query`](https://developer.mozilla.org/docs/Web/API/Permissions/query):

| Signal | Chrome / Edge | Firefox | Safari macOS | Safari iOS |
| --- | --- | --- | --- | --- |
| `Notification.permission` / `PushManager.permissionState()` read on page load | Yes | Yes | 16+ | 16.4+ (Home Screen app) |
| `permissions.query({ name: "notifications" })` | 43+ | 46+ | 16.4+ | 16.4+ |
| `PermissionStatus` `change` event | 43+ | 46+ | **Never fires** (16.4+, "the event never fires", [WebKit bug 259432](https://bugs.webkit.org/show_bug.cgi?id=259432), still NEW) | **Never fires** |
| `pushsubscriptionchange` in the service worker | 138+ (only on re-grant after revocation, not on revocation) | 44+ (no `oldSubscription`/`newSubscription`) | 16+ | **No** |

### What this means

- **Reliable everywhere:** reading `Notification.permission` (or `PushManager.permissionState()`) whenever a Cadence page loads. This is what the settings status line from [#13](https://github.com/jamesAMURR/cohort-005-project/issues/13) already needs.
- **Live updates while a page is open:** Chrome, Edge and Firefox fire the `PermissionStatus` `change` event. Safari and iOS don't, even though the handler exists.
- **While no Cadence page is open:** nothing. No browser runs Cadence code on revocation: Chrome's flag for that is off, iOS has no `pushsubscriptionchange`, and the Push API spec makes it optional. The server learns only when a send bounces.
- **Inference:** a person who revokes and never comes back is detected only by Knock's bounce. A person who revokes and comes back is detected by the page on load.

## Facts the decision ticket (#21) needs

1. **Knock already prunes dead tokens if deregistration is on.** It defaults to ON for new channels, per environment. Cadence's Development and Production FCM channels should be checked. If it's on, Cadence needs no pruning code of its own for tokens FCM reports as dead.
2. **The only server-side signal is `message.bounced`**, with the dead token in `event_data.token`. There's no "token removed" or "channel data changed" webhook, and push has no `delivered` status, so Knock can't confirm a push was actually shown.
3. **Some dead tokens may never bounce.** The cases that aren't documented to produce `UNREGISTERED` are an iOS app removed from the Home Screen, Safari website data removed, and stale tokens on a device that's gone. Firebase's own answer for these is a per-token timestamp and pruning tokens not refreshed within about a month. Knock's channel data has no timestamp, so this would need a timestamp stored somewhere (in Cadence, or in Knock's device metadata if that supports custom fields; **not checked**).
4. **When someone's last token goes, push steps are just skipped.** Nothing in Knock warns anyone. A Platform Admin whose refund pushes stopped would see no error anywhere unless Cadence acts on `message.bounced` or checks for an empty token list.
5. **The page can always tell whether this browser's push still works** (permission plus `getToken()` succeeding) on every page load, in every browser. It can't be told in real time in Safari or iOS. It can't tell whether the person's *other* browsers still work, only how many tokens Knock holds.
6. **Re-filing on every visit keeps rotated tokens current**, because `getToken()` returns the SDK's current token, refreshing it weekly or after a subscription change. This needs Cadence to check `Notification.permission === "granted"` first, because `getToken()` prompts when permission is `default`.
7. **The read-modify-write in `setChannelData` can restore a token Knock just removed.** The cost is one more bounce, not a permanent dead token.

## Not confirmed

- That Knock classifies FCM `UNREGISTERED` (and which `INVALID_ARGUMENT`s) as a bounce. The docs say only "invalid or expired tokens".
- Whether each token is its own Knock message with its own status.
- How FCM reports a Safari (APNs 410) or Firefox (404) dead subscription for a web token, and whether it's synchronous.
- Whether removing an iOS Home Screen app, or turning off its notifications in iOS Settings, unsubscribes at Apple's push service.
- What Safari macOS does to a subscription when notifications are turned off in Safari settings, or when website data is removed.
- A web-specific FCM token expiry. Firebase documents 270 days for Android only.
- None of the inferences above have been tested end to end against Cadence's Knock and Firebase setup.
