import { createApp } from 'vue';
import App from '@/App.vue';
import '@/index.css';
import { startAuth } from '@/lib/nhost/auth';
import { createAppRouter } from '@/router';

// Awaited before mounting so the first render already knows whether there is a
// session: no signed-out flash, and no protected route bouncing a signed-in
// visitor on a reload. On an ordinary load there is no token on the URL and
// this resolves without a request.
await startAuth();

// The router is created only now, from the address `startAuth` left behind.
createApp(App).use(createAppRouter()).mount('#app');
