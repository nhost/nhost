import { createApp } from 'vue';
import App from '@/App.vue';
import { createAuth } from '@/lib/nhost/auth';
import { startSession } from '@/lib/nhost/startSession';
import { createAppRouter } from '@/router';
import { guardRoutes } from '@/sessionGuard';

// Before the router reads the URL, so it never sees a link token, and before
// the first render, so no page shows a session that is about to change.
await startSession();

const router = createAppRouter();
// Before the router is installed, so its first navigation is guarded too.
const recheck = guardRoutes(router);

createApp(App).use(router).use(createAuth({ router, recheck })).mount('#app');
