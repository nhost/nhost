import { ReactNode } from "react";
import Meta from "./meta";
import { twMerge } from "tailwind-merge";

export default function Layout({
  meta,
  children,
  className,
}: {
  meta?: {
    title?: string;
    description?: string;
    image?: string;
  };
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <Meta {...meta} />
      <div className="relative h-full min-h-screen w-full overflow-x-hidden bg-black transition-all duration-300 ease-in-out">
        <main className={twMerge("grid grid-flow-row", className)}>
          {children}
        </main>
      </div>
    </>
  );
}
