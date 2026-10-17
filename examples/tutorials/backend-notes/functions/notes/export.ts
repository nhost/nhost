import type { Request, Response } from "express";
import { createServerClient } from "@nhost/nhost-js";
import { MemoryStorage } from "@nhost/nhost-js/session";

export default async (req: Request, res: Response) => {
  const authorization = req.headers.authorization ?? "";
  if (!authorization) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const nhost = createServerClient({
    region: process.env.NHOST_REGION,
    subdomain: process.env.NHOST_SUBDOMAIN,
    storage: new MemoryStorage(),
  });

  const { body } = await nhost.graphql.request<{ notes: { title: string; content: string }[] }>(
    { query: `query { notes(order_by: {updated_at: desc}) { title content } }` },
    { headers: { Authorization: authorization } },
  );

  const notes = body.data?.notes ?? [];
  const document =
    `# Notes export\n\n_${notes.length} note(s)_\n\n` +
    notes.map((n) => `# ${n.title || "Untitled"}\n\n${n.content}`).join("\n\n---\n\n");

  const fileName = `export-${Date.now()}.md`;
  const upload = await nhost.storage.uploadFiles(
    { "bucket-id": "notes", "file[]": [new File([document], fileName, { type: "text/markdown" })] },
    { headers: { Authorization: authorization } },
  );

  const file = upload.body.processedFiles?.[0];
  res.status(200).json({ fileId: file?.id, fileName, noteCount: notes.length });
};
