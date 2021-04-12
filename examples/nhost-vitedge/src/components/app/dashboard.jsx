import React from "react";

import { AddItem } from "./add-item";
import { ListItems } from "./list-items";

export default function Dashboard() {
  return (
    <div>
      <div>
        <h1>Dashboard</h1>
      </div>
      <div>
        <AddItem />
      </div>
      <div>
        <ListItems />
      </div>
    </div>
  );
}