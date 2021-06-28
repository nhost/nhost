import store from "./store";

export default function requireSignIn(to, from, next) {
  if (store.state.isSignedIn) next(true);
  else next("/login");
}
