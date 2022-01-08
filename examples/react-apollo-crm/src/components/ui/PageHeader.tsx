import React from "react";

export function PageHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
        {children}
      </h2>
    </div>
  );
}
