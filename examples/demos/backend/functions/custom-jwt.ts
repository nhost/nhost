import type { Request, Response } from "express";
import process from "node:process";
import jwt from "jsonwebtoken";
import cors from "cors";

const corsMiddleware = cors();

const getJwt = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) return null;

  return parts[1];
};

const jwtIsAuthorized = (req: Request, key: string): string => {
  const token = getJwt(req);
  if (!token) return "";

  try {
    const decoded = jwt.verify(token, key);
    const claims = decoded["https://hasura.io/jwt/claims"];
    if (!claims?.["x-hasura-allowed-roles"]) return "";

    if (
      claims["x-hasura-allowed-roles"].includes("admin") ||
      claims["x-hasura-allowed-roles"].includes("operator")
    ) {
      return decoded.sub as string;
    }

    return "";
  } catch {
    return "";
  }
};

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    let authorizedCaller = "";

    if (
      req.headers["x-hasura-admin-secret"] ===
      process.env.HASURA_GRAPHQL_ADMIN_SECRET
    ) {
      authorizedCaller = "admin";
    }

    const jwtSecret = JSON.parse(process.env.NHOST_JWT_SECRET);
    if (!authorizedCaller) {
      authorizedCaller = jwtIsAuthorized(req, jwtSecret.key);
    }

    if (!authorizedCaller) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, defaultRole, allowedRoles } = req.body;
    if (!userId || !defaultRole || !allowedRoles) {
      return res.status(400).json({ message: "Bad request" });
    }

    const token = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        "https://hasura.io/jwt/claims": {
          "x-hasura-allowed-roles": allowedRoles,
          "x-hasura-default-role": defaultRole,
          "x-hasura-user-id": userId,
          "x-hasura-user-is-anonymous": "false",
          "x-hasura-on-behalf-of": authorizedCaller,
        },
        iat: Math.floor(Date.now() / 1000),
        iss: "custom-lambda",
        sub: userId,
      },
      jwtSecret.key,
    );

    res.status(200).json({ accessToken: token });
  });
};
