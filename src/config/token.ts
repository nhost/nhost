import { castIntEnv, castStringArrayEnv } from "@config/utils";

/**
 * * Authentication settings
 */
export const TOKEN = {
  get JWT_SECRET() {
    return process.env.JWT_SECRET || "";
  },
  get ALGORITHM() {
    return process.env.JWT_ALGORITHM || "HS512";
  },
  get CLAIMS_NAMESPACE() {
    return process.env.JWT_CLAIMS_NAMESPACE || "https://hasura.io/jwt/claims";
  },
  get ACCESS_TOKEN_EXPIRES_IN() {
    return castIntEnv("ACCESS_TOKEN_EXPIRES_IN", 900);
  },
  get REFRESH_TOKEN_EXPIRES_IN() {
    return castIntEnv("REFRESH_TOKEN_EXPIRES_IN", 43200);
  },
  get CUSTOM_FIELDS() {
    return castStringArrayEnv("PROFILE_SESSION_VARIABLE_FIELDS");
  },
  get PROFILE_SESSION_VARIABLE_FIELDS() {
    return castStringArrayEnv("PROFILE_SESSION_VARIABLE_FIELDS");
  },
};
