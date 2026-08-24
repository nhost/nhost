import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/signin', component: () => import('./views/SignInView.vue') },
    {
      path: '/protected',
      component: () => import('./views/ProtectedView.vue'),
    },
  ],
});

export default router;
