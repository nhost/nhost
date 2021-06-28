import { createClient } from "nhost-js-sdk";

const config = {
  baseURL: "https://backend-5939b8f7.nhost.app",
};

const { auth, storage } = createClient(config);

export { auth, storage };
