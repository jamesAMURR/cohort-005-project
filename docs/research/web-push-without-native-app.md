# What web push can do without a native app

Research for [#4](https://github.com/jamesAMURR/cohort-005-project/issues/4), part of the map [#2 In-app Notifications for Cadence](https://github.com/jamesAMURR/cohort-005-project/issues/2). Researched 2026-11-17.

This file lists facts only. Whether Cadence should become installable is decided in a separate ticket.

## Short answer

- **Desktop Chrome, Edge, Firefox and Android Chrome/Firefox:** web push works in an ordinary browser tab. No install is needed. The site needs HTTPS, a service worker, and a permission request triggered by a user gesture.
- **Desktop Safari:** web push works in a normal tab from Safari 16 on macOS Ventura or later.
- **iOS and iPadOS:** web push works only in a web app the user has added to the Home Screen and opened from there. It needs iOS/iPadOS 16.4 or later. There is no push in a Safari tab, and Chrome and Edge on iOS have no push in a tab either.
- **Every push must show a visible notification.** Silent pushes are not allowed, and the browser or push service enforces this.
- **Rich features are uneven.** Action buttons, a large image, a monochrome badge and `requireInteraction` work in Chromium. Safari supports none of them. Firefox supports action buttons only, from Firefox 152.
- **Payload limit:** about 4 KB (3993 bytes of plaintext after encryption overhead).
- **Hosted providers:** they generally generate and hold the VAPID keys and send the pushes. Cadence would still have to serve the provider's service worker on its own origin.

## Platform support

The version numbers come from MDN browser-compat-data ([`PushManager`](https://github.com/mdn/browser-compat-data/blob/main/api/PushManager.json), [`ServiceWorkerRegistration.showNotification`](https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerRegistration.json)).

| Platform | Push API since | Install required? | Notes |
| --- | --- | --- | --- |
| Chrome desktop | 42 | No | Needs an `applicationServerKey` (VAPID). |
| Edge desktop | 17 | No | Needs an `applicationServerKey`. |
| Firefox desktop | 44 | No | Since Firefox 72, `subscribe()` and `requestPermission()` only work from a user gesture. |
| Safari macOS | 16 | No | Needs macOS Ventura (13) or later. |
| Chrome Android | 42 | No | |
| Firefox Android | 48 | No | Since Firefox Android 79, only works from a user gesture. |
| Safari iOS/iPadOS | 16.4 | **Yes, Home Screen web app** | BCD note: "Notifications are supported in web apps saved to the home screen." |

Sources:

- WebKit, [Meet Web Push](https://webkit.org/blog/12945/meet-web-push/): "Web Push is supported in Safari 16 on macOS Ventura". You do not need to join the Apple Developer Program.
- WebKit, [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): support arrived in iOS/iPadOS 16.4. "A web app that has been added to the Home Screen can request permission to receive push notifications." No Apple Developer Program membership is needed.

## iOS and iPadOS: the Home Screen requirement

- **Minimum version:** iOS/iPadOS 16.4 ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Must be installed:** the web app must be added to the Home Screen and opened from there before it can even ask for permission. OneSignal's docs say the same from the provider side: "iOS does not show the permission prompt until the user adds your site to their Home Screen" ([OneSignal web push setup](https://documentation.onesignal.com/docs/web-push-setup)). Its FAQ also says the site "must be added to home screen and opened from there" ([OneSignal FAQ](https://documentation.onesignal.com/docs/web-push-setup-faq)).
- **Manifest before iOS 26:** the site needed a manifest whose `display` is `standalone` or `fullscreen`, or the `apple-mobile-web-app-capable` meta tag. Without one, "Add to Home Screen" only made a bookmark that opened in Safari, with no push ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **iOS/iPadOS 26 and later:** "By default, every website added to the Home Screen opens as a web app". Users can switch off "Open as Web App". Manifest icons and other members are still used if present ([WebKit, News from WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)). So from iOS 26 a manifest is no longer strictly needed to get a web app, but it is still the way to control name, icons and `id`.
- **Manifest `id`:** identifies the web app. iOS uses it to sync Focus settings across a user's devices ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Third-party browsers:** from iOS 16.4, other browsers (Chrome, Edge, Firefox and others) can offer "Add to Home Screen" from the Share menu. Those web apps reopen in the browser that created them ([WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)). All iOS browsers use WebKit, so none of them has push in a tab.
- **The user's journey is long:** open the site, tap Share, tap Add to Home Screen, launch from the icon, then tap an in-app button to grant permission. A user who never installs never gets push on iPhone.
- **Extras for Home Screen web apps:** the Badging API (`navigator.setAppBadge` and `clearAppBadge`) works in iOS 16.4 web apps, even before notification permission is granted. Notifications also follow the user's Focus modes ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Delivery and allow-listing:** Apple delivers web push through APNs. If the server allow-lists push endpoints, it must allow `*.push.apple.com` ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

## What the service worker must provide

- An active service worker is required to subscribe and to receive push ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)). It handles the `push` event and calls `registration.showNotification()`. It should also handle `notificationclick` so it can open the right Cadence URL, and `pushsubscriptionchange` for when a subscription expires.
- HTTPS (secure context) is required ([MDN `PushManager.subscribe`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)). Localhost counts as a secure context during development.
- `subscribe({ userVisibleOnly: true, applicationServerKey })` is required:
  - Chrome and Edge reject the call without an `applicationServerKey` (BCD note) and without `userVisibleOnly: true` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).
  - Safari requires `userVisibleOnly: true` and revokes the subscription if the site breaks that promise ([WebKit Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)).
  - Edge "doesn't support push messages that aren't displayed to the user". If no notification is shown, Edge shows a generic one instead ([Microsoft Edge docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)).
- Firefox gives pushes that show no notification a limited quota. Pushes that do show one are exempt ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
- **Scope and origin:** a subscription belongs to one service worker on one origin. Subscribers cannot be moved to another origin ([OneSignal FAQ](https://documentation.onesignal.com/docs/web-push-setup-faq), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)). Hosted providers need their service worker served from Cadence's own origin. For example, FCM "requires a `firebase-messaging-sw.js` file" at the domain root ([Firebase](https://firebase.google.com/docs/cloud-messaging/js/client)).
- **Secret endpoint:** the subscription endpoint is a capability URL and must be kept secret ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
- **Declarative Web Push (Apple only):** from iOS/iPadOS 18.4 and Safari 18.5 on macOS 15.5, a push payload with `"web_push": 8030` and a `notification` object (a `title` and a `navigate` URL are required, `app_badge` is optional) is shown without running a service worker. Other browsers handle the same message through their normal service-worker path ([WebKit, Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)). This is an optimisation and does not remove the cross-browser need for a service worker.

## What the web app manifest must provide

- **For push on desktop and Android:** no manifest is needed. Push works in a normal tab.
- **For push on iOS before 26:** `display: standalone` or `fullscreen` (see above).
- **For Chrome's install prompt** (only relevant if Cadence decides to be installable):
  - `name` or `short_name`;
  - 192px and 512px icons;
  - `start_url`;
  - `display` set to `fullscreen`, `standalone`, `minimal-ui` or `window-controls-overlay`;
  - `prefer_related_applications` absent or `false`;
  - HTTPS;
  - a user who has clicked the page at least once and spent at least 30 seconds on it.

  Source: [web.dev install criteria](https://web.dev/articles/install-criteria).

## Permission-prompt rules

- **User gesture:**
  - Firefox: since Firefox 72 (79 on Android), `Notification.requestPermission()` and `PushManager.subscribe()` "can now only be called in response to a user gesture such as a click event" ([MDN Firefox 72 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/72)).
  - Safari: requesting a push subscription requires an explicit user gesture ([WebKit Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)). On iOS the request must come "in response to direct user interaction", for example tapping a subscribe button ([WebKit 16.4 post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
  - Chrome and Edge do not strictly require a gesture, but their docs and MDN recommend one ([MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static), [Edge docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)).
  - In practice: request permission only from a button click in the UI, never on page load.
- **No cross-origin iframes:** Chrome and Firefox no longer allow notification permission requests from cross-origin `<iframe>`s ([MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)).
- **Chrome's quiet UI:** this replaces the prompt with a small icon in the address bar.
  - From Chrome 80, it is turned on automatically "for users who typically block notification permission requests" and "on sites with very low opt in rates". Users can also enable it themselves in settings ([Chromium blog, Jan 2020](https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html)).
  - From Chrome 84, sites with abusive permission requests or abusive notifications are also enrolled automatically ([Chromium blog, May 2020](https://blog.chromium.org/2020/05/protecting-chrome-users-from-abusive.html)).
  - A low accept rate caused by prompting too early is therefore self-punishing.
- **Chrome auto-revoke (Oct 2025):** Chrome on Android and desktop now revokes notification permission for sites with low engagement and high notification volume. It warns the user first, and installed web apps are exempt ([Google blog](https://blog.google/chromium/automatic-notification-permission/); details from secondary coverage, thresholds not published).
- **Edge:** `subscribe()` prompts for permission if it has not been granted. It throws a `DOMException` if the user denies ([Edge docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)).
- **Denied is final for the site:** once the user denies, the site cannot prompt again. Only the user can reset it in browser or OS settings. The `default` state is treated as denied ([MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)).

## Payload and feature limits

- **Payload size:** "A push service is not required to support more than 4096 octets of payload body", which "equates to, at most, 3993 octets of plaintext" ([RFC 8291](https://datatracker.ietf.org/doc/html/rfc8291)). Send a short title, body and URL or id, and let the client fetch anything bigger.
- **`showNotification` options:** `title`, `body`, `icon`, `image`, `badge`, `actions`, `data`, `tag`, `renotify`, `requireInteraction`, `silent`, `vibrate`, `timestamp`, `dir`, `lang` and `navigate` ([MDN showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification)). Support differs by browser:

| Option | Chrome / Edge (desktop and Android) | Firefox | Safari macOS / iOS |
| --- | --- | --- | --- |
| `title`, `body`, `icon`, `tag`, `data` | Yes | Yes | Yes |
| `actions` (buttons) | Chrome 48+, Edge 18+ (count limited by `Notification.maxActions`) | 152+ | **No** |
| `image` (large image) | Chrome 56+ | **No** | **No** |
| `badge` (status-bar monochrome icon; Android ~96px) | Chrome 53+ | **No** | **No** |
| `requireInteraction` | Chrome 47+ | **No** | **No** |

Source: MDN browser-compat-data (`ServiceWorkerRegistration.showNotification.options_*`, `Notification.maxActions_static`).

- **App icon badge (`navigator.setAppBadge`):** works on Chrome 81+ for installed apps on Windows and macOS, and on ChromeOS from Chrome 91. It does not work on Chrome Android or Firefox. Safari 17+ supports it for installed web apps on macOS Sonoma. iOS/iPadOS 16.4+ supports it for Home Screen web apps ([BCD `Navigator.setAppBadge`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)).
- **No silent or background-only pushes** anywhere (see the service worker section). Push cannot be used to quietly sync the Inbox. Each push must show a notification. The live-updating Inbox still needs polling or websockets on the page.
- **Each browser and device has its own subscription.** One Cadence user with a laptop and a phone has two or more subscriptions. A provider or server has to keep them all under the user's id ([OneSignal web push setup](https://documentation.onesignal.com/docs/web-push-setup): subscriptions "stay anonymous until you assign an External ID").
- **The push service belongs to the browser vendor.** Developers cannot choose it: Chrome uses FCM, Firefox uses Mozilla autopush, Apple uses APNs, Edge uses Windows Push Notification Services. Messages are encrypted end to end ([web.dev push overview](https://web.dev/articles/push-notifications-overview)).

## Do hosted providers handle VAPID keys and delivery?

Generally, yes. The provider holds the VAPID key pair and calls the browser push services. Cadence still hosts the provider's service worker on its own origin and calls the provider's SDK to subscribe the user after a gesture.

- **What VAPID is:** a P-256 key pair. The public key is passed as `applicationServerKey`. Every push is signed with the private key ([MDN subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [web.dev](https://web.dev/articles/push-notifications-overview)). The key pair is tied to the existing subscriptions, so moving to another sender means either taking the same keys along or re-subscribing users.
- **Firebase Cloud Messaging:** you can generate a key pair in the console ("Generate Key Pair" under Web Push certificates) or import your own. You must also host `firebase-messaging-sw.js` ([Firebase docs](https://firebase.google.com/docs/cloud-messaging/js/client)).
- **OneSignal:** you host its service worker and a manifest (for iOS) on your origin. Subscriptions are linked to users through an External ID. Migration guides from other vendors say OneSignal creates VAPID keys per app and origin, and that you must ask OneSignal support to export them ([OneSignal setup](https://documentation.onesignal.com/docs/web-push-setup), [WonderPush migration guide](https://docs.wonderpush.com/docs/importing-web-push-subscribers)). That this needs support help is reported by third parties and is not confirmed in OneSignal's own docs.
- **MagicBell:** its Web Push channel takes a VAPID `public_key` and `private_key` ([MagicBell docs](https://www.magicbell.com/docs/channels/web_push)). Its marketing says it can also generate and rotate them for you.
- **Notification orchestrators (Novu, Knock):** these do not send browser web push themselves. They route to a push provider:
  - Novu lists FCM, APNs, OneSignal, Expo, Pusher Beams, Pushpad and Push Webhook ([Novu push docs](https://docs.novu.co/platform/integrations/push)).
  - Knock lists APNs, FCM, Expo, OneSignal and Amazon SNS ([Knock push docs](https://docs.knock.app/integrations/push/overview)).
  - For browser push from either, Cadence would pair it with FCM (web), OneSignal or Pushpad, and that service holds the VAPID keys.

## Facts the "should Cadence become installable?" ticket needs

1. Without install, Cadence gets web push on every desktop browser and on Android. iPhone and iPad users get **none**.
2. To reach iOS users, Cadence must be addable to the Home Screen. Before iOS 26 that needs a manifest with `display: standalone`. The user also has to install it and grant permission from inside the installed app with a tap.
3. Desktop and Android push needs only HTTPS, a service worker on Cadence's origin and a permission request from a button. A manifest is optional there.
4. Notifications should be designed around the lowest common feature set (title, body, icon, click-through URL). Treat action buttons and images as Chromium-only extras, with Firefox actions only from version 152.
