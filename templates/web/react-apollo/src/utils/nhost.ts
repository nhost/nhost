import { NhostClient } from "@nhost/nhost-js";

const nhost = new NhostClient({
  backendUrl: "insert_backend_url_here",
});

export { nhost };
