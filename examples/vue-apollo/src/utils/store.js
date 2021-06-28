import { reactive } from "vue";

const store = {
  state: reactive({
    isSignedIn: null,
  }),

  setSignedIn(status) {
    this.state.isSignedIn = status;
    if (this.authDoneLoading && this.state.isSignedIn !== null) {
      this.authDoneLoading();
    }
  },

  // Used to make sure app stalls while auth is still loading
  isAuthLoaded: async function () {
    return new Promise((resolve) => {
      if (this.state.isSignedIn !== null) resolve();
      // This allows setSignedIn() to resolve the promise once the auth status changes
      else store.authDoneLoading = resolve;
    });
  },
};

export default store;
