import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../lib/nhost/auth";
import Profile from "../views/Profile.vue";
import SignIn from "../views/SignIn.vue";
import SignUp from "../views/SignUp.vue";
import Todos from "../views/Todos.vue";
import Upload from "../views/Upload.vue";
import Verify from "../views/Verify.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/signin",
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
      name: "Profile",
      component: Profile,
      meta: { requiresAuth: true },
    },
    {
      path: "/todos",
      name: "Todos",
      component: Todos,
      meta: { requiresAuth: true },
    },
    {
      path: "/upload",
      name: "Upload",
      component: Upload,
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
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated.value) {
      return "/signin";
    }
  }
  return true;
});

export default router;
