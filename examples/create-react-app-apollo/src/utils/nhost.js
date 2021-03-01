import { createClient } from "nhost-js-sdk";

const config = {
  baseURL: process.env.REACT_APP_BACKEND_ENDPOINT,
};

const { auth, storage } = createClient(config);

export { auth, storage };
