// import { request } from "@/test/server";
import { request } from "../../../test/server";
import { Client } from "pg";
import { mailHogSearch, deleteAllMailHogEmails } from "../../../test/utils";

describe("email-password", () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it("should sign up user", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(200);
  });

  it("should fail to sign up with same email", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(200);

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(400);
  });

  it("should fail register if whitelist is enabled and the email is not in whitelist", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: true,
      WHITELIST_ENABLED: true,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(401);
  });

  it("should fail with weak password", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: true,
      WHITELIST_ENABLED: false,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(400);
  });

  it("should succeed to sign up with different emails", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(200);

    await request
      .post("/signup/email-password")
      .send({ email: "joedoes@example.com", password: "123456" })
      .expect(200);
  });

  it("should fail sending email", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      EMAILS_ENABLED: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post("/signup/email-password")
      .send({ email: "joedoe@example.com", password: "123456" })
      .expect(500);
  });

  it("should success with SMTP settings", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      EMAILS_ENABLED: "true",
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = "joedoe@example.com";

    await request
      .post("/signup/email-password")
      .send({ email, password: "123456" })
      .expect(200);

    // fetch email from mailhog and check ticket
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers["X-Ticket"][0];
    expect(ticket.startsWith("signUpEmailPassword:")).toBeTruthy();
  });

  it("default role must be part of allowed roles", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = "joedoe@example.com";

    await request
      .post("/signup/email-password")
      .send({
        email,
        password: "123456",
        defaultRole: "user",
        allowedRoles: ["editor"],
      })
      .expect(400);
  });

  it("allowed roles must be subset of env var ALLOWED_USER_ROLES", async () => {
    // set env vars
    await await request.post("/change-env").send({
      AUTO_ACTIVATE_NEW_USERS: true,
      ALLOWED_USER_ROLES: "user,editor",
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = "joedoe@example.com";

    await request
      .post("/signup/email-password")
      .send({
        email,
        password: "123456",
        defaultRole: "user",
        allowedRoles: ["user", "some-other-role"],
      })
      .expect(400);
  });
});
