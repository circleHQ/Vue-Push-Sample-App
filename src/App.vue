<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import CirclePush, { type CirclePushConfig } from '@circlehq/push-web';

// ─── Reactive state ──────────────────────────────────────────────────
const email = ref('');
const phone = ref('');
const fatalError = ref<string | null>(null);
const sdkVersion = ref<string>('—');
const permission = ref<string>('—');
const tokenDisplay = ref<string>('—');
const deviceId = ref<string>('—');
const contactId = ref<string>('—');
const logEntries = ref<string[]>([]);
const identifyBusy = ref(false);
const unregisterBusy = ref(false);

// ─── Logger ──────────────────────────────────────────────────────────
function log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${level.toUpperCase()} ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
    .join(' ')}`;
  logEntries.value.push(line);
}

// ─── Build config from Vite env ──────────────────────────────────────
function readConfig(): CirclePushConfig {
  const apiKey = import.meta.env.VITE_CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Missing VITE_CIRCLE_API_KEY. Copy .env.example to .env.local and fill it in.',
    );
  }
  return {
    apiKey,
    apiBaseUrl: import.meta.env.VITE_CIRCLE_API_BASE_URL,
    debug: import.meta.env.DEV,
  };
}

// ─── Status panel ────────────────────────────────────────────────────
function refreshStatus(): void {
  sdkVersion.value = CirclePush.version;
  permission.value = CirclePush.getPermissionState();
  void CirclePush.getToken().then((t) => {
    tokenDisplay.value = t ? `${t.slice(0, 8)}…${t.slice(-4)}` : '—';
  });
}

let statusTimer: number | undefined;

// ─── Wire SDK events ─────────────────────────────────────────────────
const offHandlers: Array<() => void> = [];
function wireEvents(): void {
  offHandlers.push(
    CirclePush.on('permissionChange', (p) => log('info', 'permissionChange:', p)),
    CirclePush.on('tokenRefresh', (t) =>
      log('info', 'tokenRefresh:', {
        old: t.oldToken?.slice(0, 8),
        new: t.newToken.slice(0, 8),
      }),
    ),
    CirclePush.on('notificationReceived', (p) => log('info', 'notificationReceived:', p)),
    CirclePush.on('notificationClicked', (p) => log('info', 'notificationClicked:', p)),
    CirclePush.on('error', (e) => log('error', `SDK error ${e.code}:`, e.message)),
  );
}

// ─── Sign in (identify + permission + token registration) ────────────
async function onIdentify(): Promise<void> {
  if (!email.value.trim() && !phone.value.trim()) {
    log('warn', 'Enter an email or phone before signing in.');
    return;
  }
  identifyBusy.value = true;
  try {
    const perm = await CirclePush.requestPermission();
    log('info', 'permission:', perm);
    if (perm !== 'granted') {
      log('warn', 'Notification permission was not granted; aborting sign in.');
      return;
    }
    const identity: { email?: string; phone?: string } = {};
    if (email.value.trim()) identity.email = email.value.trim();
    if (phone.value.trim()) identity.phone = phone.value.trim();
    const device = await CirclePush.identify(identity);
    deviceId.value = device.deviceId;
    contactId.value = device.contactId;
    log('info', 'Signed in. Device registered for push.', device);
    refreshStatus();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    log('error', 'sign in failed', err.code ?? '', err.message ?? String(e));
  } finally {
    identifyBusy.value = false;
  }
}

// ─── Disable notifications (unregister) ──────────────────────────────
async function onUnregister(): Promise<void> {
  unregisterBusy.value = true;
  try {
    await CirclePush.unregister();
    deviceId.value = '—';
    contactId.value = '—';
    log('info', 'Notifications disabled for this device.');
    refreshStatus();
  } catch (e) {
    log('error', 'unregister failed', String(e));
  } finally {
    unregisterBusy.value = false;
  }
}

// ─── Init on mount ───────────────────────────────────────────────────
onMounted(async () => {
  wireEvents();
  refreshStatus();
  let cfg: CirclePushConfig;
  try {
    cfg = readConfig();
  } catch (e) {
    fatalError.value = (e as Error).message;
    log('error', (e as Error).message);
    return;
  }
  try {
    await CirclePush.init(cfg);
    log('info', 'SDK initialized');
    refreshStatus();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const msg = `SDK init failed: ${err.code ?? ''} ${err.message ?? String(e)}`;
    fatalError.value = msg;
    log('error', msg);
  }
  statusTimer = window.setInterval(refreshStatus, 2000);
});

onUnmounted(() => {
  if (statusTimer !== undefined) window.clearInterval(statusTimer);
  for (const off of offHandlers) off();
});
</script>

<template>
  <main>
    <h1>Circle Push — Vue Sample</h1>
    <p class="muted">
      A minimal example of integrating <code>@circlehq/push-web</code> in a Vue app.
      The SDK is initialized on mount from values in <code>.env.local</code>. Sign
      in with an email or phone to register this device for push.
    </p>

    <div v-if="fatalError" class="panel error">{{ fatalError }}</div>

    <div class="panel">
      <label>Sign in</label>
      <p class="muted">
        Identify the current user. In a real app you'd call this after your own
        login flow completes.
      </p>
      <div class="row">
        <input v-model="email" type="email" placeholder="user@example.com" autocomplete="email" />
        <input v-model="phone" type="tel" placeholder="+1 555 123 4567" autocomplete="tel" />
      </div>
      <div class="row">
        <button :disabled="identifyBusy || !!fatalError" @click="onIdentify">
          Sign in &amp; enable notifications
        </button>
        <button class="secondary" :disabled="unregisterBusy || !!fatalError" @click="onUnregister">
          Disable notifications
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="grid">
        <b>SDK version</b><span>{{ sdkVersion }}</span>
        <b>Permission</b><span>{{ permission }}</span>
        <b>Push token</b><span>{{ tokenDisplay }}</span>
        <b>Device ID</b><span>{{ deviceId }}</span>
        <b>Contact ID</b><span>{{ contactId }}</span>
      </div>
    </div>

    <details>
      <summary class="muted">Event log</summary>
      <pre>{{ logEntries.join('\n') }}</pre>
    </details>
  </main>
</template>

<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; }
main { max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
h1 { margin: 0 0 1rem; }
.row { display: flex; gap: .5rem; flex-wrap: wrap; margin: .5rem 0 1rem; }
button {
  padding: .55rem 1rem; border: 1px solid #888; border-radius: .375rem;
  background: #f7f7f7; cursor: pointer; font: inherit;
}
button:hover { background: #ececec; }
button:disabled { opacity: .5; cursor: not-allowed; }
button.secondary { background: transparent; }
input, textarea {
  width: 100%; padding: .5rem; border: 1px solid #888; border-radius: .375rem;
  font: inherit; box-sizing: border-box;
}
label { display: block; margin: .5rem 0 .25rem; font-weight: 600; }
.panel {
  background: #f4f4f4; border: 1px solid #ddd; padding: .75rem; border-radius: .5rem;
  margin: 1rem 0;
}
.panel.error { background: #fde7e7; border-color: #f5b5b5; color: #7a1f1f; }
.grid { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; }
.grid b { color: #555; }
pre {
  background: #111; color: #eee; padding: .75rem; border-radius: .5rem;
  max-height: 320px; overflow: auto; font-size: 12px;
}
details > summary { cursor: pointer; margin: 1rem 0 .5rem; }
.muted { color: #666; font-size: .9rem; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
@media (prefers-color-scheme: dark) {
  button { background: #222; color: #eee; border-color: #555; }
  button:hover { background: #333; }
  button.secondary { background: transparent; }
  .panel { background: #1a1a1a; border-color: #333; }
  .panel.error { background: #3a1414; border-color: #6a2424; color: #f5b5b5; }
  input, textarea { background: #1a1a1a; color: #eee; border-color: #555; }
}
</style>
