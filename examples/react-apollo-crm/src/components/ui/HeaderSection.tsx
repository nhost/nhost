import React from "react";

export function HeaderSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 md:flex md:items-center md:justify-between">
      {children}
    </div>
  );
}
