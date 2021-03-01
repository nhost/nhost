import React from "react";
import { Header } from "./header";

export function Layout({ children }) {
  return (
    <div>
      <Header />
      <div>{children}</div>
    </div>
  );
}
