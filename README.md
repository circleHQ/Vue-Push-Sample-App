# Circle Push — Vue Sample

How to add web push notifications to your **Vue** app using
[`@circlehq/push-web`](https://www.npmjs.com/package/@circlehq/push-web).

This guide walks through integrating the SDK into your own Vue 3 + Vite
project. A runnable demo lives in this repo — see
[Running this sample](#running-this-sample) at the bottom.

---

## Prerequisites

- Node.js 18+
- A Circle publishable **API key** (from the Circle dashboard)
- A working Vue 3 app (Vite recommended)
- Web Push requires **HTTPS or `localhost`** — it will not work over plain
  HTTP on a remote host.

## Install

```bash
npm install @circlehq/push-web
```

The SDK ships a `postinstall` hook that copies its prebuilt service worker
into your app's `public/firebase-messaging-sw.js` automatically. If you
install with `--ignore-scripts` (or your CI does), run the bundled CLI
manually:

```bash
npx circle-push install-sw
```

You should now see `public/firebase-messaging-sw.js` in your project. Add
it to `.gitignore` — it's regenerated on every install:

```
public/firebase-messaging-sw.js
```

## Add your API key

Vite exposes env vars prefixed with `VITE_` to the browser. Create
`.env.local` at the project root:

```
VITE_CIRCLE_API_KEY=your_publishable_key
```

Only ship values that are safe in a public bundle.

## Initialize the SDK

Initialize once when the app boots — either in `main.ts` before
`app.mount(...)` or in `App.vue`'s `onMounted`. `init()` is idempotent
and safe to call more than once.

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import CirclePush from '@circlehq/push-web';

onMounted(async () => {
  await CirclePush.init({
    apiKey: import.meta.env.VITE_CIRCLE_API_KEY,
    debug: import.meta.env.DEV,
  });
});
</script>
```

## Identify a user after sign-in

`requestPermission()` must be triggered by a user gesture (button click).
Then call `identify()` with whatever contact info you have:

```ts
const permission = await CirclePush.requestPermission();
if (permission !== 'granted') return;

await CirclePush.identify({ email: 'user@example.com' });
// or: await CirclePush.identify({ phone: '+15551234567' });
// or both: await CirclePush.identify({ email, phone });
```

This registers the current browser as a push device for that contact.

## Handle events (optional)

Subscribe to SDK events and clean up on unmount:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import CirclePush from '@circlehq/push-web';

const offHandlers: Array<() => void> = [];

onMounted(() => {
  offHandlers.push(
    CirclePush.on('notificationReceived', (payload) => {
      console.log('received in foreground', payload);
    }),
    CirclePush.on('notificationClicked', (payload) => {
      console.log('user clicked notification', payload);
    }),
  );
});

onUnmounted(() => {
  for (const off of offHandlers) off();
});
</script>
```

## Disable push on sign-out

```ts
await CirclePush.unregister();
```

## Test it

1. Run the app on `localhost`.
2. Sign in and call `identify()`.
3. Send a push from the Circle dashboard.
4. Confirm the notification appears, then click it and verify
   `notificationClicked` fires.

## API reference

| Method | Description |
|---|---|
| `CirclePush.init(config)` | Initialize. Call once on app load. |
| `CirclePush.identify({ email?, phone? })` | Register this browser as a push device for the contact. |
| `CirclePush.requestPermission()` | Prompt for notification permission. |
| `CirclePush.unregister()` | Disable push for this device. |
| `CirclePush.getToken()` | Current FCM token, or `null`. |
| `CirclePush.getPermissionState()` | `'granted' \| 'denied' \| 'default'`. |
| `CirclePush.on(event, handler)` / `off(event, handler)` | Subscribe / unsubscribe. |

Events: `permissionChange`, `tokenRefresh`, `notificationReceived`,
`notificationClicked`, `error`.

## Browser support

| Browser | Supported |
|---|---|
| Chrome, Edge, Firefox, Opera (desktop & Android) | ✅ |
| Safari macOS 16.4+ | ✅ |
| Safari iOS 16.4+ | ✅ when installed as a PWA |

## Running this sample

```bash
git clone https://github.com/circleHQ/Vue-Push-Sample-App.git
cd Vue-Push-Sample-App
npm install
echo "VITE_CIRCLE_API_KEY=your_key" > .env.local
npm run dev
```

Then open <http://localhost:5173>. The integration lives in
[src/App.vue](src/App.vue).

## Learn more

- npm: <https://www.npmjs.com/package/@circlehq/push-web>
- Docs: <https://docs.circle.so>
- Dashboard: <https://app.circle.so>
