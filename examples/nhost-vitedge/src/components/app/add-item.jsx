import React, { useState } from "react";
import gql from "graphql-tag";
import { useMutation } from "@apollo/client";

const INSERT_ITEM = gql`
  mutation insertItem($item: items_insert_input!) {
    insert_items_one(object: $item) {
      id
    }
  }
`;

export function AddItem() {
  const [name, setName] = useState("");
  const [insertItem] = useMutation(INSERT_ITEM);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await insertItem({
        variables: {
          item: {
            name,
          },
        },
      });
    } catch (error) {
      console.error(error);
      return alert("Failed adding item");
    }

    setName("");
    alert("Item added");
  }

  return (
    <div>
      <div>Add item</div>

      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <button type="submit">Add item</button>
        </div>
      </form>
    </div>
  );
}