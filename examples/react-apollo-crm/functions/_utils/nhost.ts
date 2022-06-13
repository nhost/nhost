import { NhostClient } from "@nhost/nhost-js";

const nhost = new NhostClient({
  backendUrl: process.env.NHOST_BACKEND_URL!,
});

export { nhost };
