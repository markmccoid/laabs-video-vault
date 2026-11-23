# The Browser Extension signs in with its own Convex Auth session

The Browser Extension signs in with email and password and keeps its own Convex Auth session, so it calls the normal public functions and `requireUserId` stays the only gate. It doesn't use a share token like the Share Extension (ADR 0001). That ADR rejected sharing the *app's* session because the extension and the app would race over one single-use refresh token. A browser extension has no host app, so its session is its own.

Inside the extension, the popup and the service worker (toolbar badge) both need the session. Tokens live in `chrome.storage.local`, and refreshing is serialized with the Web Locks API, so only one context spends the refresh token at a time. Every call is a one-shot `ConvexHttpClient` request, not a WebSocket subscription. That keeps Convex function calls and bandwidth low on the free plan, and an MV3 service worker can't keep a socket open anyway.

We rejected share-token pairing: it would need new HTTP routes for folders, lookups, and timestamps, plus a pairing step from another device.
