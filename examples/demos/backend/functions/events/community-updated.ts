import type { Request, Response } from "express";
import cors from "cors";
import { createClient, withAdminSession } from "@nhost/nhost-js";

const corsMiddleware = cors();

export default async (req: Request, res: Response) => {
  corsMiddleware(req, res, async () => {
    const webhookSecret = req.headers["nhost-webhook-secret"];
    if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event = req.body.event;
    if (!event) {
      return res.status(400).json({ message: "No event payload" });
    }

    const { old: oldRow, new: newRow } = event.data;

    if (oldRow.description === newRow.description) {
      return res.status(200).json({ message: "Description unchanged, skipping" });
    }

    const editorUserId = event.session_variables?.["x-hasura-user-id"];

    const nhost = createClient({
      region: process.env.NHOST_REGION,
      subdomain: process.env.NHOST_SUBDOMAIN,
      configure: [
        withAdminSession({
          adminSecret: process.env.NHOST_ADMIN_SECRET,
        }),
      ],
    });

    const { body } = await nhost.graphql.request<{
      community_members: Array<{ user_id: string }>;
      communities_by_pk: { name: string } | null;
    }>({
      query: `
        query GetCommunityMembers($communityId: uuid!) {
          community_members(where: { community_id: { _eq: $communityId } }) {
            user_id
          }
          communities_by_pk(id: $communityId) {
            name
          }
        }
      `,
      variables: { communityId: newRow.id },
    });

    if (body.errors) {
      return res.status(500).json({ errors: body.errors });
    }

    const members = body.data?.community_members || [];
    const communityName = body.data?.communities_by_pk?.name || "A community";

    const recipients = members.filter((m) => m.user_id !== editorUserId);

    if (recipients.length === 0) {
      return res.status(200).json({ message: "No recipients" });
    }

    const notifications = recipients.map((m) => ({
      user_id: m.user_id,
      title: `${communityName} description updated`,
      message: newRow.description || "Description was cleared",
      type: "community_update",
    }));

    const insertResult = await nhost.graphql.request<{
      insert_notifications: { affected_rows: number } | null;
    }>({
      query: `
        mutation InsertNotifications($objects: [notifications_insert_input!]!) {
          insert_notifications(objects: $objects) {
            affected_rows
          }
        }
      `,
      variables: { objects: notifications },
    });

    if (insertResult.body.errors) {
      return res.status(500).json({ errors: insertResult.body.errors });
    }

    res.status(200).json({
      message: `Notified ${recipients.length} member(s)`,
    });
  });
};
