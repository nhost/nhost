import type { Request, Response } from "express";
import cors from "cors";
import { createClient, withAdminSession } from "@nhost/nhost-js";

const corsMiddleware = cors();

const nhost = createClient({
  region: process.env.NHOST_REGION,
  subdomain: process.env.NHOST_SUBDOMAIN,
  configure: [
    withAdminSession({
      adminSecret: process.env.NHOST_ADMIN_SECRET,
    }),
  ],
});

export default async (req: Request, res: Response) => {
  corsMiddleware(req, res, async () => {
    const { body } = await nhost.graphql.request({
      query: `
        query {
          users {
            id
            email
            displayName
          }
        }
      `,
    });

    if (body.errors) {
      return res.status(400).json({ errors: body.errors });
    }

    res.status(200).json(body.data);
  });
};
