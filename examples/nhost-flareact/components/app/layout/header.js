import React from "react";
import Link from "flareact/link";
import gql from "graphql-tag";
import { useQuery } from "@apollo/client";

import { auth } from "../../../utils/nhost";

const GET_SELF = gql`
  query getSelf($user_id: uuid!) {
    me: users_by_pk(id: $user_id) {
      id
      display_name
      account {
        id
        email
      }
    }
  }
`;

function UserInfoHeader() {
  const { loading, error, data } = useQuery(GET_SELF, {
    variables: {
      user_id: auth.getClaim("x-hasura-user-id"),
    },
    context: {
      headers: {
        "x-hasura-role": "me",
      },
    },
  });

  if (loading && !data) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.error(error);
    return <div>Error getting user data</div>;
  }

  const { me } = data;

  return (
    <div>
      <div>
        User: {me.display_name} ({me.account.email})
      </div>
      <div onClick={() => auth.logout()}>Logout</div>
    </div>
  );
}

export function Header() {
  return (
    <div>
      <div>
        <div>
          <Link href="/">
            <a>Dashboard</a>
          </Link>
        </div>
        <div>
          <Link href="/files">
            <a>Files</a>
          </Link>
        </div>
        <div>
          <Link href="/settings">
            <a>Settings</a>
          </Link>
        </div>
        <div>
          <a
            onClick={() => {
              auth.logout();
            }}
            href="/settings"
          ></a>
        </div>
      </div>
      <div>
        <UserInfoHeader />
      </div>
    </div>
  );
}
