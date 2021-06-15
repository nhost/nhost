import { createClient } from "nhost-js-sdk";

const config = {
  baseURL: "https://backend-YOUR_URL.nhost.app",
};

const { auth, storage } = createClient(config);

export { auth, storage };
