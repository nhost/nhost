import { APPLICATION } from "@config/index";

import Email from "email-templates";
import nodemailer from "nodemailer";
import ejs from "ejs";
import { gqlSdk } from "./utils/gqlSDK";

/**
 * SMTP transport.
 */
const transport = nodemailer.createTransport({
  host: APPLICATION.SMTP_HOST,
  port: Number(APPLICATION.SMTP_PORT),
  secure: Boolean(APPLICATION.SMTP_SECURE),
  auth: {
    pass: APPLICATION.SMTP_PASS,
    user: APPLICATION.SMTP_USER,
  },
  authMethod: APPLICATION.SMTP_AUTH_METHOD,
});

/**
 * Reusable email client.
 */
export const emailClient: Email<any> = new Email({
  transport,
  message: { from: APPLICATION.SMTP_SENDER },
  send: true,
  render: async (view, locals) => {
    const [id, field] = view.split("/");
    const locale = locals.locale;

    if (!locale) {
      throw new Error("Cannot send email without locale");
    }

    const email = await gqlSdk
      .emailTemplate({
        id,
        locale,
      })
      .then((res) => res.AuthEmailTemplate);

    if (!email) {
      throw new Error(`Cannot find email ${id}(${locale})`);
    }

    if (field === "subject") return email.title;
    else if (field === "html")
      return await emailClient.juiceResources(ejs.render(email.html, locals));
    else if (field === "text") return email.noHtml;
    else throw new Error(`Unknown field ${field}`);
  },
});
