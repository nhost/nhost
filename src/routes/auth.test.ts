import "jest-extended";
import { v4 as uuidv4 } from "uuid";

import { APPLICATION, JWT as CONFIG_JWT, HEADERS } from "@config/index";
import {
  generateRandomEmail,
  generateRandomString,
  mailHogSearch,
  registerAccount,
  registerAndLoginAccount,
  getHeaderFromLatestEmailAndDelete,
} from "test/utils";

import { JWT } from "jose";
import { Token } from "@/types";
import {
  end,
  saveJwt,
  validJwt,
  statusCode,
} from "test/supertest-shared-utils";

import { Response } from "superagent";

import { withEnv } from "../../test/utils";

import { request } from "../../test/server";

function errorMessageEqual(msg: string) {
  return (res: Response) => {
    expect(res.body.message).toEqual(msg);
  };
}

function isAnonymous() {
  return (res: Response) => {
    expect(res.body.user.email).toBeFalsy();
  };
}

it("should tell the password has been pwned", (done) => {
  withEnv(
    {
      HIBP_ENABLED: "true",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({ email: generateRandomEmail(), password: "123456" })
        .expect(statusCode(400))
        .expect(errorMessageEqual("Password is too weak"))
        .end(end(done));
    },
    done
  );
});

it("should create an user", (done) => {
  request
    .post("/register")
    .send({
      email: generateRandomEmail(),
      password: generateRandomString(),
    })
    .expect(statusCode(200))
    .end(end(done));
});

it("should create an user with custom column", (done) => {
  request
    .post("/register")
    .send({
      email: generateRandomEmail(),
      password: generateRandomString(),
      customRegisterData: {
        name: "Test name",
      },
    })
    .expect(statusCode(200))
    .end(end(done));
});

it("should create an user without a password when magic link login is enabled", (done) => {
  withEnv(
    {
      MAGIC_LINK_ENABLED: "true",
      AUTO_ACTIVATE_NEW_USERS: "false",
      VERIFY_EMAILS: "true",
    },
    request,
    (done) => {
      const email = generateRandomEmail();
      let ticket = "";

      request
        .post("/register")
        .send({ email })
        .expect(statusCode(200))
        .expect((res) => {
          expect(res.body.user.email).toBeTruthy();
        })
        .end(async (err) => {
          if (err) return done(err);

          if (
            !(await getHeaderFromLatestEmailAndDelete(email, "X-Ticket").then(
              (t) => (ticket = t!)
            ))
          ) {
            return done(new Error("No ticket received in email"));
          }

          request
            .get(`/magic-link?action=register&token=${ticket}`)
            .expect(statusCode(302))
            .end(end(done));
        });
    },
    done
  );
});

it("should not create an user without a password when magic link login is disabled", (done) => {
  withEnv(
    {
      MAGIC_LINK_ENABLED: "false",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({ email: generateRandomEmail() })
        .expect(statusCode(400))
        .end(end(done));
    },
    done
  );
});

it("should fail to create user with unallowed role", (done) => {
  request
    .post("/register")
    .send({
      email: generateRandomEmail(),
      password: generateRandomString(),
      defaultRole: "invalid role",
      allowedRoles: ["user", "me", "super-admin"],
    })
    .expect(statusCode(400))
    .end(end(done));
});

it("should fail to create user with defaultRole that does not overlap allowedRoles", (done) => {
  withEnv(
    {
      AUTO_ACTIVATE_NEW_USERS: "true",
      ALLOWED_USER_ROLES: ["user", "me", "anonymous"].join(","),
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
          defaultRole: "editor",
          allowedRoles: ["user", "me"],
        })
        .expect(statusCode(400))
        .end(end(done));
    },
    done
  );
});

it("should create user with defaultRole that is in the ALLOWED_USER_ROLES variable", (done) => {
  withEnv(
    {
      AUTO_ACTIVATE_NEW_USERS: "true",
      ALLOWED_USER_ROLES: ["user", "me", "editor", "anonymous"].join(","),
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
          defaultRole: "editor",
        })
        .expect(statusCode(200))
        .end(end(done));
    },
    done
  );
});

it("should register user with defaultRole and allowedRoles set", (done) => {
  request
    .post("/register")
    .send({
      email: generateRandomEmail(),
      password: generateRandomString(),
      defaultRole: "user",
      allowedRoles: ["user", "me"],
    })
    .expect(statusCode(200))
    .end(end(done));
});

it("should tell the email is already in use", (done) => {
  const email = generateRandomEmail();
  const password = generateRandomString();

  request
    .post("/register")
    .send({ email, password })
    .end((err) => {
      if (err) return done(err);
      request
        .post("/register")
        .send({ email, password })
        .expect(statusCode(400))
        .expect(errorMessageEqual("Email already in use"))
        .end(end(done));
    });
});

it("should fail to activate an user from a wrong ticket", (done) => {
  withEnv(
    {
      AUTO_ACTIVATE_NEW_USERS: "false",
      EMAILS_ENABLED: "true",
      REDIRECT_URL_ERROR: "",
    },
    request,
    (done) => {
      request
        .get(`/activate?ticket=${uuidv4()}`)
        .expect(statusCode(401))
        .end(end(done));
    },
    done
  );
});

it("should activate the user from a valid ticket", (done) => {
  withEnv(
    {
      AUTO_ACTIVATE_NEW_USERS: "false",
      VERIFY_EMAILS: "true",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      const email = generateRandomEmail();
      const password = generateRandomString();
      let ticket = "";

      request
        .post("/register")
        .send({ email, password })
        .expect(statusCode(200))
        .end(async (err) => {
          if (err) return done(err);

          if (
            !(await getHeaderFromLatestEmailAndDelete(email, "X-Ticket").then(
              (t) => (ticket = t!)
            ))
          ) {
            return done(new Error("No ticket received in email"));
          }

          request
            .get(`/activate?ticket=${ticket}`)
            .expect(statusCode(302))
            .end(end(done));
        });
    },
    done
  );
});

it("should not sign user with wrong password", (done) => {
  withEnv(
    {
      AUTO_ACTIVATE_NEW_USERS: "true",
    },
    request,
    (done) => {
      registerAccount(request).then(({ email, password }) => {
        request
          .post("/login")
          .send({ email, password: password + "-incorrect" })
          .expect(statusCode(401))
          .end(end(done));
      });
    },
    done
  );
});

it("should not sign in non existing user", (done) => {
  request
    .post("/login")
    .send({ email: "non-existing@nhost.io", password: "sommar" })
    .expect(statusCode(401))
    .end(end(done));
});

it("should complain about incorrect email", (done) => {
  request
    .post("/login")
    .send({ email: "not-valid-email", password: "sommar" })
    .expect(statusCode(400))
    .end(end(done));
});

it("should sign the user in", (done) => {
  registerAccount(request).then(({ email, password }) => {
    request
      .post("/login")
      .send({ email, password })
      .expect(statusCode(200))
      .expect(validJwt())
      .end(end(done));
  });
});

it("should sign the user in without password when magic link is enabled", (done) => {
  withEnv(
    {
      MAGIC_LINK_ENABLED: "true",
      AUTO_ACTIVATE_NEW_USERS: "false",
      VERIFY_EMAILS: "true",
      WHITELIST: "false",
      ADMIN_ONLY_REGISTRATION: "false",
      EMAILS_ENABLE: "true",
    },
    request,
    (done) => {
      const email = generateRandomEmail();
      let ticket = "";

      request
        .post("/register")
        .send({ email })
        .expect(statusCode(200))
        .expect((res) => {
          expect(res.body.user.email).toBeTruthy();
        })
        .end(async (err) => {
          if (err) return done(err);

          if (
            !(await getHeaderFromLatestEmailAndDelete(email, "X-Ticket").then(
              (t) => (ticket = t!)
            ))
          ) {
            return done(new Error("No ticket received in email"));
          }

          request
            .get(`/magic-link?action=register&token=${ticket}`)
            .expect(statusCode(302))
            .end((err) => {
              if (err) return done(err);

              let ticket = "";

              request
                .post("/login")
                .send({ email })
                .expect(statusCode(200))
                .expect((res) => {
                  expect(res.body.magicLink).toBeTrue();
                })
                .end(async (err) => {
                  if (err) return done(err);

                  if (
                    !(await getHeaderFromLatestEmailAndDelete(
                      email,
                      "X-Ticket"
                    ).then((t) => (ticket = t!)))
                  ) {
                    return done(new Error("No ticket received in email"));
                  }

                  request
                    .get(`/magic-link?action=log-in&token=${ticket}`)
                    .expect(statusCode(302))
                    .end(end(done));
                });
            });
        });
    },
    done
  );
});

it("should not sign the user in without password when magic link is disabled", (done) => {
  withEnv(
    {
      MAGIC_LINK_ENABLED: "false",
    },
    request,
    (done) => {
      request
        .post("/login")
        .send({ email: generateRandomEmail() })
        .expect(statusCode(400))
        .end(end(done));
    },
    done
  );
});

it("should not sign user in with invalid admin secret", (done) => {
  withEnv(
    {
      USER_IMPERSONATION_ENABLED: "true",
    },
    request,
    (done) => {
      registerAccount(request).then(({ email }) => {
        request
          .post("/login")
          .set(HEADERS.ADMIN_SECRET_HEADER, "invalidsecret")
          .send({ email, password: "invalidpassword" })
          .expect(statusCode(401))
          .end(end(done));
      });
    },
    done
  );
});

it("should not sign in user with valid admin secret if user impersonation is not enabled", (done) => {
  withEnv(
    {
      USER_IMPERSONATION_ENABLED: "false",
    },
    request,
    (done) => {
      registerAccount(request).then(({ email, password }) => {
        request
          .post("/login")
          .set(
            HEADERS.ADMIN_SECRET_HEADER,
            APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
          )
          .send({ email, password: generateRandomString() })
          .expect(statusCode(401))
          .end(end(done));
      });
    },
    done
  );
});

it("should sign in user with valid admin secret", (done) => {
  withEnv(
    {
      USER_IMPERSONATION_ENABLED: "true",
    },
    request,
    (done) => {
      registerAccount(request).then(({ email, password }) => {
        request
          .post("/login")
          .set(
            HEADERS.ADMIN_SECRET_HEADER,
            APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
          )
          .send({ email, password })
          .expect(statusCode(200))
          .expect(validJwt())
          .end(end(done));
      });
    },
    done
  );
});

it("should decode a valid custom user claim", (done) => {
  let jwtToken = "";
  withEnv(
    { REGISTRATION_CUSTOM_FIELDS: "name", JWT_CUSTOM_FIELDS: "name" },
    request,
    (done) => {
      registerAccount(request, {
        name: "Test name",
      }).then(({ email, password }) => {
        request
          .post("/login")
          .send({ email, password })
          .expect(statusCode(200))
          .expect(saveJwt((j) => (jwtToken = j)))
          .end((err) => {
            if (err) return done(err);

            const decodedJwt = JWT.decode(jwtToken) as Token;
            expect(decodedJwt[CONFIG_JWT.CLAIMS_NAMESPACE]).toBeObject();
            console.log("jjwt", decodedJwt[CONFIG_JWT.CLAIMS_NAMESPACE]);
            // Test if the custom claims work
            expect(
              decodedJwt[CONFIG_JWT.CLAIMS_NAMESPACE]["x-hasura-name"]
            ).toEqual("Test name");
            done();
          });
      });
    },
    done
  );
});

it("should logout", (done) => {
  registerAndLoginAccount(request).then(({ refreshToken }) => {
    request
      .post(`/logout`)
      .query({ refreshToken })
      .send()
      .expect(statusCode(204))
      .end(end(done));
  });
});

it("should delete an user", (done) => {
  withEnv(
    {
      ALLOW_USER_SELF_DELETE: "true",
    },
    request,
    (done) => {
      registerAndLoginAccount(request).then(({ jwtToken }) => {
        request
          .post(`/delete`)
          .set({ Authorization: `Bearer ${jwtToken}` })
          .expect(statusCode(204))
          .end(end(done));
      });
    },
    done
  );
});

it("should log in anonymously", (done) => {
  const anonymousRole = "anonymous";

  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "true",
      DEFAULT_ANONYMOUS_ROLE: anonymousRole,
      ALLOWED_USER_ROLES: ["user", "me", "editor", anonymousRole].join(","),
    },
    request,
    (done) => {
      request
        .post("/login")
        .send({
          anonymous: true,
        })
        .expect(statusCode(200))
        .expect(validJwt())
        .expect(isAnonymous())
        .end(end(done));
    },
    done
  );
});

it("should be able to deanonymize anonymous user", (done) => {
  const anonymousRole = "anonymous";
  let jwtToken = "";

  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "true",
      DEFAULT_ANONYMOUS_ROLE: anonymousRole,
      ALLOWED_USER_ROLES: ["user", "me", "editor", anonymousRole].join(","),
      AUTO_ACTIVATE_NEW_USERS: "true",
    },
    request,
    (done) => {
      request
        .post("/login")
        .send({
          anonymous: true,
        })
        .expect(statusCode(200))
        .expect(validJwt())
        .expect(saveJwt((j) => (jwtToken = j)))
        .expect(isAnonymous())
        .end((err) => {
          if (err) return done(err);

          const email = generateRandomEmail();
          const password = generateRandomString();

          request
            .post("/deanonymize")
            .set({ Authorization: `Bearer ${jwtToken}` })
            .send({
              email,
              password,
            })
            .expect(statusCode(204))
            .end((err) => {
              if (err) return done(err);

              request
                .post("/login")
                .send({ email, password })
                .expect(statusCode(200))
                .expect(validJwt())
                .end(end(done));
            });
        });
    },
    done
  );
});

it("should be able to deanonymize anonymous user without auto activation", (done) => {
  const anonymousRole = "anonymous";
  let jwtToken = "";

  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "true",
      DEFAULT_ANONYMOUS_ROLE: anonymousRole,
      ALLOWED_USER_ROLES: ["user", "me", "editor", anonymousRole].join(","),
      AUTO_ACTIVATE_NEW_USERS: "false",
      REDIRECT_URL_SUCCESS: "",
      REDIRECT_URL_ERROR: "",
    },
    request,
    (done) => {
      request
        .post("/login")
        .send({
          anonymous: true,
        })
        .expect(statusCode(200))
        .expect(validJwt())
        .expect(saveJwt((j) => (jwtToken = j)))
        .expect(isAnonymous())
        .end((err) => {
          if (err) return done(err);

          const email = generateRandomEmail();
          const password = generateRandomString();

          request
            .post("/deanonymize")
            .set({ Authorization: `Bearer ${jwtToken}` })
            .send({
              email,
              password,
            })
            .expect(statusCode(204))
            .end(async (err) => {
              if (err) return done(err);

              let ticket = "";
              if (
                !(await getHeaderFromLatestEmailAndDelete(
                  email,
                  "X-Ticket"
                ).then((t) => (ticket = t!)))
              ) {
                return done(new Error("No ticket email sent"));
              }

              request
                .get(`/activate?ticket=${ticket}`)
                .expect(statusCode(302))
                .end((err) => {
                  if (err) return done(err);

                  request
                    .post("/login")
                    .send({ email, password })
                    .expect(statusCode(200))
                    .expect(validJwt())
                    .end(end(done));
                });
            });
        });
    },
    done
  );
}, 10000);

it("should not be able to deanonymize normal user", (done) => {
  const anonymousRole = "anonymous";
  let jwtToken = "";

  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "true",
      DEFAULT_ANONYMOUS_ROLE: anonymousRole,
      ALLOWED_USER_ROLES: ["user", "me", "editor", anonymousRole].join(","),
    },
    request,
    (done) => {
      registerAccount(request).then(({ email, password }) => {
        request
          .post("/login")
          .send({ email, password })
          .expect(validJwt())
          .expect(saveJwt((j) => (jwtToken = j)))
          .expect(statusCode(200))
          .end((err) => {
            if (err) return done(err);

            request
              .post("/deanonymize")
              .set({ Authorization: `Bearer ${jwtToken}` })
              .send({
                email: generateRandomEmail(),
                password: generateRandomString(),
              })
              .expect(statusCode(401))
              .end(end(done));
          });
      });
    },
    done
  );
});

it("should log in normally when anonymous login is enabled", (done) => {
  const anonymousRole = "anonymous";
  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "true",
      DEFAULT_ANONYMOUS_ROLE: anonymousRole,
      ALLOWED_USER_ROLES: ["user", "me", "editor", anonymousRole].join(","),
    },
    request,
    (done) => {
      registerAccount(request).then(({ email, password }) => {
        request
          .post("/login")
          .send({ email, password })
          .expect(validJwt())
          .expect(statusCode(200))
          .end(end(done));
      });
    },
    done
  );
});

it("should not be able to log in anonymously when anonymous login is disabled", (done) => {
  withEnv(
    {
      ANONYMOUS_USERS_ENABLED: "false",
    },
    request,
    (done) => {
      request
        .post("/login")
        .send({
          anonymous: true,
        })
        .expect(statusCode(400))
        .end(end(done));
    },
    done
  );
});

it("should not be able to register with admin only registration", (done) => {
  withEnv(
    {
      ADMIN_ONLY_REGISTRATION: "true",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
        })
        .expect(statusCode(401))
        .end(end(done));
    },
    done
  );
});

it("should not be able to register with admin only registration with incorrect x-admin-secret", (done) => {
  withEnv(
    {
      ADMIN_ONLY_REGISTRATION: "true",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
        })
        .set({ "x-admin-secret": generateRandomString() })
        .expect(statusCode(401))
        .end(end(done));
    },
    done
  );
});

it("should be able to register with admin only registration with correct x-admin-secret", (done) => {
  withEnv(
    {
      ADMIN_ONLY_REGISTRATION: "true",
      AUTO_ACTIVATE_NEW_USERS: "true",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
        })
        .set({ "x-admin-secret": process.env.HASURA_GRAPHQL_ADMIN_SECRET })
        .expect(statusCode(200))
        .end(end(done));
    },
    done
  );
});

it("should resend the confirmation email after the timeout", (done) => {
  withEnv(
    {
      CONFIRMATION_RESET_TIMEOUT: "0",
      AUTO_ACTIVATE_NEW_USERS: "false",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      const email = generateRandomEmail();
      const password = generateRandomString();

      request
        .post("/register")
        .send({
          email,
          password,
        })
        .expect(statusCode(200))
        .end((err) => {
          if (err) return done(err);

          request
            .post("/resend-confirmation")
            .send({
              email,
            })
            .expect(statusCode(200))
            .end(async (err) => {
              if (err) return done(err);
              if (
                !(await getHeaderFromLatestEmailAndDelete(email, "X-Ticket"))
              ) {
                return done(new Error("No ticket sent to email"));
              }
              done();
            });
        });
    },
    done
  );
});

it("should not resend the confirmation email on an activated user", (done) => {
  withEnv(
    {
      CONFIRMATION_RESET_TIMEOUT: "0",
      AUTO_ACTIVATE_NEW_USERS: "false",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      registerAccount(request).then(({ email }) => {
        request
          .post("/resend-confirmation")
          .send({
            email,
          })
          .expect(statusCode(400))
          .end(end(done));
      });
    },
    done
  );
});

it("should not resend the confirmation email on a non-existant user", (done) => {
  withEnv(
    {
      CONFIRMATION_RESET_TIMEOUT: "0",
      AUTO_ACTIVATE_NEW_USERS: "false",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      request
        .post("/resend-confirmation")
        .send({
          email: generateRandomEmail(),
        })
        .expect(statusCode(400))
        .end(end(done));
    },
    done
  );
});

it("should not resend the confirmation email before the timeout", (done) => {
  withEnv(
    {
      CONFIRMATION_RESET_TIMEOUT: "5000",
      AUTO_ACTIVATE_NEW_USERS: "false",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      const email = generateRandomEmail();
      const password = generateRandomString();

      request
        .post("/register")
        .send({
          email,
          password,
        })
        .expect(statusCode(200))
        .end((err) => {
          if (err) return done(err);

          request
            .post("/resend-confirmation")
            .send({
              email,
            })
            .expect(statusCode(400))
            .end(end(done));
        });
    },
    done
  );
});

it("should disable login for arbitrary emails when whitelist is enabled", (done) => {
  withEnv(
    {
      WHITELIST_ENABLED: "true",
    },
    request,
    (done) => {
      request
        .post("/register")
        .send({
          email: generateRandomEmail(),
          password: generateRandomString(),
        })
        .expect(statusCode(401))
        .end(end(done));
    },
    done
  );
});

it("should enable login for allowed emails when whitelist is enabled", (done) => {
  const email = generateRandomEmail();

  withEnv(
    {
      WHITELIST_ENABLED: "true",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      request
        .post("/whitelist")
        .set(
          HEADERS.ADMIN_SECRET_HEADER,
          APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        )
        .send({
          email,
        })
        .expect(statusCode(204))
        .end((err) => {
          if (err) return done(err);

          request
            .post("/register")
            .send({
              email,
              password: generateRandomString(),
            })
            .expect(statusCode(200))
            .end(end(done));
        });
    },
    done
  );
});

it("should enable login for allowed emails when whitelist is enabled and send an invite", (done) => {
  const email = generateRandomEmail();

  withEnv(
    {
      WHITELIST_ENABLED: "true",
      EMAILS_ENABLED: "true",
    },
    request,
    (done) => {
      request
        .post("/whitelist")
        .set(
          HEADERS.ADMIN_SECRET_HEADER,
          APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        )
        .send({
          email,
          invite: true,
        })
        .expect(statusCode(204))
        .end(async (err) => {
          if (err) return done(err);

          if (!(await mailHogSearch(email).then((messages) => messages[0]))) {
            done(new Error("No email was sent"));
          }

          request
            .post("/register")
            .send({
              email,
              password: generateRandomString(),
            })
            .expect(statusCode(200))
            .end(end(done));
        });
    },
    done
  );
});

it("Should disable the whitelist endpoint when the whitelist is disabled", (done) => {
  const email = generateRandomEmail();

  withEnv(
    {
      WHITELIST_ENABLED: "false",
    },
    request,
    (done) => {
      request
        .post("/whitelist")
        .set(
          HEADERS.ADMIN_SECRET_HEADER,
          APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        )
        .send({
          email,
        })
        .expect(statusCode(501))
        .end(end(done));
    },
    done
  );
});

it("should be able to change user locale", (done) => {
  registerAndLoginAccount(request).then(({ jwtToken }) => {
    request
      .post("/change-locale")
      .set({ Authorization: `Bearer ${jwtToken}` })
      .send({
        locale: "gr",
      })
      .expect(statusCode(204))
      .end(end(done));
  });
});
