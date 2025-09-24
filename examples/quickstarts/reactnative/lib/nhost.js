import { createClient } from "@nhost/nhost-js";

export const nhost = createClient({
  subdomain: "local",
  region: "local",
})
