import { createApp } from 'vue';
import App from '@/App.vue';
import { createAppRouter } from '@/router';

createApp(App).use(createAppRouter()).mount('#app');
