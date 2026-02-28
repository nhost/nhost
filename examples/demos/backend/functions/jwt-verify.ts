import process from "node:process";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import cors from "cors";

const corsMiddleware = cors();

const subdomain = process.env.NHOST_SUBDOMAIN;
const region = process.env.NHOST_REGION;

const client = jwksClient({
  jwksUri: `https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000,
});

export default (req: Request, res: Response) => {
  corsMiddleware(req, res, () => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: missing header" });
    }

    const token = authHeader.split(" ")[1];

    const verifyToken = new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key.getPublicKey());
          });
        },
        { algorithms: ["RS256", "RS384", "RS512"] },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        },
      );
    });

    verifyToken
      .then((decoded) => {
        res.status(200).json({ token: decoded });
      })
      .catch((err) => {
        res.status(401).json({ error: `Unauthorized: ${err}` });
      });
  });
};
