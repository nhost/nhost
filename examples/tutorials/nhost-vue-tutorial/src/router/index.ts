import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../lib/nhost/auth";
import HomeView from "../views/HomeView.vue";
import ProfileView from "../views/ProfileView.vue";
import SignIn from "../views/SignIn.vue";
import SignUp from "../views/SignUp.vue";
import Verify from "../views/Verify.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/signin",
      name: "SignIn",
      component: SignIn,
    },
    {
      path: "/signup",
      name: "SignUp",
      component: SignUp,
    },
    {
      path: "/verify",
      name: "Verify",
      component: Verify,
    },
    {
      path: "/profile",
      name: "profile",
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

// Navigation guard for protected routes
router.beforeEach((to) => {
  if (to.meta["requiresAuth"]) {
    const { isAuthenticated, isLoading } = useAuth();

    // Show loading state while authentication is being checked
    if (isLoading.value) {
      // You can return a loading component path or handle loading in the component
      return true; // Allow navigation, handle loading in component
    }

    if (!isAuthenticated.value) {
      return "/"; // Redirect to home page
    }
  }
  return true;
});

export default router;

