import type { Request, Response } from "express";
import cors from "cors";
import { createClient } from "@nhost/nhost-js";

const corsMiddleware = cors();

const nhost = createClient({
  region: process.env.NHOST_REGION,
  subdomain: process.env.NHOST_SUBDOMAIN,
});

export default async (req: Request, res: Response) => {
  corsMiddleware(req, res, async () => {
    const { body } = await nhost.graphql.request(
      {
        query: `
          query {
            todos {
              id
              title
              completed
            }
          }
        `,
      },
      {
        headers: {
          Authorization: req.headers.authorization ?? "",
        },
      },
    );

    if (body.errors) {
      return res.status(400).json({ errors: body.errors });
    }

    res.status(200).json(body.data);
  });
};
