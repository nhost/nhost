import { castStringArrayEnv } from "./utils";

export const ENV = {
  get DEFAULT_LOCALE() {
    return process.env.DEFAULT_LOCALE || "en";
  },

  get ALLOWED_LOCALES() {
    return castStringArrayEnv("ALLOWED_LOCALES") || ["en"];
  },
};
