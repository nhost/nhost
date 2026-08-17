import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../lib/nhost/auth';
import FilesView from '../views/FilesView.vue';
import HomeView from '../views/HomeView.vue';
import ProfileView from '../views/ProfileView.vue';
import SignIn from '../views/SignIn.vue';
import SignUp from '../views/SignUp.vue';
import TodosView from '../views/TodosView.vue';
import VerifyView from '../views/VerifyView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/signin',
      name: 'SignIn',
      component: SignIn,
    },
    {
      path: '/signup',
      name: 'SignUp',
      component: SignUp,
    },
    {
      path: '/verify',
      name: 'Verify',
      component: VerifyView,
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/todos',
      name: 'Todos',
      component: TodosView,
      meta: { requiresAuth: true },
    },
    {
      path: '/files',
      name: 'Files',
      component: FilesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

// Navigation guard for protected routes
router.beforeEach((to) => {
  if (to.meta['requiresAuth']) {
    const { isAuthenticated, isLoading } = useAuth();

    // Show loading state while authentication is being checked
    if (isLoading.value) {
      // You can return a loading component path or handle loading in the component
      return true; // Allow navigation, handle loading in component
    }

    if (!isAuthenticated.value) {
      return '/'; // Redirect to home page
    }
  }
  return true;
});

export default router;
