import React from "react";
import gql from "graphql-tag";
import { useSubscription } from "@apollo/client";

const GET_ITEMS = gql`
  subscription getItems {
    items {
      id
      name
    }
  }
`;

export function ListItems() {
  const { loading, error, data } = useSubscription(GET_ITEMS);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.error(error);
    return <div>Error loading items</div>;
  }

  const { items } = data;

  return (
    <div>
      {items.map((item) => {
        return <div key={item.id}>{item.name}</div>;
      })}
    </div>
  );
}