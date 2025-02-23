import { analytics } from "@/lib/segment";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Analytics() {
  const router = useRouter();

  useEffect(() => {
    analytics.page();

    router.events.on("routeChangeComplete", () => analytics.page());

    return () => {
      router.events.off("routeChangeComplete", () => analytics.page());
    };
  }, [router.events]);

  return null;
}
