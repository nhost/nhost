import { Request, Response } from "express";
import { nhost } from "../../../src/utils/nhost";

const handler = async (req: Request, res: Response) => {
  if (
    req.headers["nhsot-webhook-secret"] !== process.env.NHSOT_WEBHOOK_SECRET
  ) {
    return res.status(401).send("Unauthorized");
  }

  // User who just signed up
  const user = req.body.event.data.new;

  // Get the user's email domain
  const emailDomain = user.email.split("@")[1];

  // Check if a company with the user's email domain already exists.
  const GET_COMPANY_WITH_EMAIL_DOMAIN = `
  query getCompanyWithEmailDomain($emailDomain: String!) {
    companies(where: { emailDomain: { _eq: $emailDomain } }) {
      id
    }
  }
  `;
  const { data, error } = await nhost.graphql.request(
    GET_COMPANY_WITH_EMAIL_DOMAIN,
    {
      emailDomain,
    },
    {
      headers: {
        "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET,
      },
    }
  );

  if (error) {
    return res.status(500).send(error);
  }

  const { companies } = data as any;

  let companyId;
  if (companies.length === 1) {
    // if a company already exists, use that company's id
    companyId = companies[0].id;
  } else {
    // else, create a new company for the newly created user with the same email domain as the user
    const CREATE_NEW_COMPANY = `
  mutation insertCompany($emailDomain: String!) {
    insertCompany(object: { name: $emailDomain, emailDomain: $emailDomain }) {
      id
    }
  }
  `;
    const { data, error } = await nhost.graphql.request(
      CREATE_NEW_COMPANY,
      {
        emailDomain,
      },
      {
        headers: {
          "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET,
        },
      }
    );

    if (error) {
      return res.status(500).send(error);
    }

    const { insertCompany } = data as any;

    companyId = insertCompany.id;
  }

  // We now have the company id of an existing, or a newly created company.
  // Now let's add the user to the company.

  const ADD_USER_TO_COMPANY = `
  mutation addUserToCompany($userId: uuid!, $companyId: uuid!) {
    insertCompanyUser(object: {userId: $userId, companyId: $companyId}) {
      id
    }
  }
  `;
  const { error: addUserToCompanyError } = await nhost.graphql.request(
    ADD_USER_TO_COMPANY,
    {
      userId: user.id,
      companyId,
    },
    {
      headers: {
        "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET,
      },
    }
  );

  if (addUserToCompanyError) {
    return res.status(500).send(error);
  }

  res.status(200).send(`OK`);
};

export default handler;
