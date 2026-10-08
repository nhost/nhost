import type { Component } from 'vue';
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router';
import Home from '@/Home.vue';
import ProtectedPage from '@/protected/ProtectedPage.vue';
import SignInPage from '@/signin/SignInPage.vue';

/**
 * Every page under `src/auth/`, found rather than listed.
 *
 * A sign-in method is meant to be deletable by removing its directory and its
 * line in `signin/methods.ts`, and nothing else. A route table naming each
 * method would break that: deleting the directory would leave this file
 * importing a component that is gone. So the pages are collected from disk,
 * the way a file-based router does it, and this file never names a method.
 *
 * `eager` because these are the app's own routes: there is nothing to defer,
 * and it keeps the records synchronous so there is no loading state here.
 */
const pages = import.meta.glob<{ default: Component }>('./auth/**/route.vue', {
  eager: true,
});

// './auth/<method>/route.vue' is the page at '/auth/<method>', and a nested
// './auth/<method>/<step>/route.vue' is the page one level under it. No real
// method is named here, deliberately: this file has to survive any of them
// being deleted.
const routePath = (file: string): string =>
  file.replace(/^\./, '').replace(/\/route\.vue$/, '');

const authRoutes: RouteRecordRaw[] = Object.entries(pages).map(
  ([file, page]) => ({
    path: routePath(file),
    component: page.default,
  }),
);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/signin', component: SignInPage },
    { path: '/protected', component: ProtectedPage },
    ...authRoutes,
  ],
});
