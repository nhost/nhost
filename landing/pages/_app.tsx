import "@/styles/globals.css";

import { Inter } from "@next/font/google";
import localFont from "@next/font/local";
import { Analytics } from "@vercel/analytics/react";
import cx from "classnames";
import type { AppProps } from "next/app";
import { Provider as RWBProvider } from "react-wrap-balancer";

const sfPro = localFont({
  src: "../styles/SF-Pro-Display-Medium.otf",
  variable: "--font-sf",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const mona = localFont({
  src: "../styles/Mona-Sans-Bold.woff2",
  variable: "--font-mona",
});

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <RWBProvider>
      <main className={cx(sfPro.variable, inter.variable, mona.variable)}>
        <Component {...pageProps} />
      </main>
      <Analytics />
    </RWBProvider>
  );
}
