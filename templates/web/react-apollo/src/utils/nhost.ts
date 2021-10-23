import { NhostClient } from "@nhost/nhost-js";

const nhost = new NhostClient({
  backendUrl: "http://localhost:1337",
});

export { nhost };
