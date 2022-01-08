import { Request, Response } from "express";
import { nhost } from "../../../src/utils/nhost";

const handler = async (req: Request, res: Response) => {
  if (
    req.headers["nhsot-webhook-secret"] !== process.env.NHSOT_WEBHOOK_SECRET
  ) {
    return res.status(401).send("Unauthorized");
  }

  const user = req.body.event.data.new;

  // check if company with email domain exists
  const emailDomain = user.email.split("@")[1];

  // if company exists, attach user to copmany
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
  // copmany exists
  if (companies.length === 1) {
    companyId = companies[0].id;
  } else {
    // create company

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

  console.log(data);
  console.log(error);

  if (addUserToCompanyError) {
    return res.status(500).send(error);
  }

  // else (company does not exist), create company and attach user to company

  res.status(200).send(`Hello ${req.query.name}!`);
};

export default handler;
