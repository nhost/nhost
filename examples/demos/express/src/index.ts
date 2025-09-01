import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { createServerClient } from "@nhost/nhost-js";
import { type Session } from "@nhost/nhost-js/session";
import { type FileMetadata } from "@nhost/nhost-js/storage";

const app = express();
const port = 4000;

app.use(cookieParser());
app.use(express.json());

// This is a simple example of how to use the Nhost client in an Express server
// reading the session from cookies passed in the request
const nhostClientFromCookies = (req: Request) => {
  return createServerClient({
    subdomain: "local",
    region: "local",
    storage: {
      get: (): Session | null => {
        return (JSON.parse(req.cookies.nhostSession) || null) as Session | null;
      },
      set: () => {
        throw new Error("It is easier to handle the session in the client");
      },
      remove: () => {
        throw new Error("It is easier to handle the session in the client");
      },
    },
  });
};

// This is a simple example of how to use the Nhost client in an Express server
// reading the Authorization header passed in the request. Note in this case
// the session only has partial information.
const nhostClientFromAuthHeader = (req: Request) => {
  return createServerClient({
    subdomain: "local",
    region: "local",
    storage: {
      get: (): Session | null => {
        const s = req.headers.authorization || null;
        if (!s) {
          return null;
        }

        if (typeof s !== "string") {
          return null;
        }

        const token = s.split(" ")[1];
        if (!token) {
          return null;
        }
        const session = { accessToken: token } as Session;
        return session;
      },
      set: () => {
        throw new Error("It is easier to handle the session in the client");
      },
      remove: () => {
        throw new Error("It is easier to handle the session in the client");
      },
    },
  });
};

interface GraphqlGetFilesResponse {
  files: FileMetadata[];
}

app.post("/cookies", async (req: Request, res: Response) => {
  const nhost = nhostClientFromCookies(req);

  try {
    const response = await nhost.graphql.request<GraphqlGetFilesResponse>({
      query: `query GetFiles {
            files {
              id
              name
              size
              mimeType
              bucketId
              uploadedByUserId
            }
          }`,
    });
    res.json({
      session: nhost.getUserSession(),
      files: response.body.data?.files,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err?.message });
    return;
  }
});

app.post("/auth-header", async (req: Request, res: Response) => {
  const nhost = nhostClientFromAuthHeader(req);
  try {
    const response = await nhost.graphql.request<GraphqlGetFilesResponse>({
      query: `query GetFiles {
              files {
                id
                name
                size
                mimeType
                bucketId
                uploadedByUserId
              }
            }`,
    });
    res.json({
      session: nhost.getUserSession(),
      files: response.body.data?.files,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err?.message });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
