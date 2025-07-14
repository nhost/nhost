import { CookieConsent } from '@/components/common/CookieConsent';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Divider } from '@/components/ui/v2/Divider';
import { SignUpTabs } from '@/features/auth/SignUp/SignUpTabs';
import { SignUpWithGithub } from '@/features/auth/SignUp/SignUpWithGithub';
import NextLink from 'next/link';
import type { ReactElement } from 'react';
import { useCallback } from 'react';

declare global {
  interface Window {
    gtag: (command: string, ...args: any[]) => void;
    dataLayer: any[];
  }
}

export default function SignUpPage() {
  const initializeGoogleAds = useCallback(() => {
    if (window.gtag) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer.push(args);
    }
    window.gtag = gtag;

    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-390000803';
    script.async = true;

    script.onerror = () => {
      console.error('Failed to load Google Ads script');
    };

    script.onload = () => {
      gtag('js', new Date());
      gtag('config', 'AW-390000803', {
        linker: {
          domains: ['nhost.io', 'app.nhost.io'],
          accept_incoming: true,
        },
      });
    };

    document.head.appendChild(script);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-12 font-[Inter]">
        <h1 className="text-center text-3.5xl font-semibold lg:text-4.5xl">
          Sign Up
        </h1>

        <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
          <SignUpWithGithub />

          <div className="relative py-2">
            <p className="absolute left-0 right-0 top-1/2 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-sm text-[#68717A]">
              OR
            </p>

            <Divider />
          </div>
          <SignUpTabs />
          <Divider className="!my-2" />
          <p className="text-center text-sm text-[#A2B3BE]">
            By signing up, you agree to our{' '}
            <NextLink
              href="https://nhost.io/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white"
            >
              Terms of Service
            </NextLink>{' '}
            and{' '}
            <NextLink
              href="https://nhost.io/legal/privacy-policy"
              rel="noopener noreferrer"
              className="font-semibold text-white"
            >
              Privacy Policy
            </NextLink>
          </p>
        </div>
        <SignUpTabs />
        <Divider className="!my-2" />
        <p className="text-center text-sm text-[#A2B3BE]">
          By signing up, you agree to our{' '}
          <NextLink
            href="https://nhost.io/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white"
          >
            Terms of Service
          </NextLink>{' '}
          and{' '}
          <NextLink
            href="https://nhost.io/legal/privacy-policy"
            rel="noopener noreferrer"
            className="font-semibold text-white"
          >
            Privacy Policy
          </NextLink>
        </p>
      </div>

      <CookieConsent onAccept={initializeGoogleAds} />
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return <UnauthenticatedLayout title="Sign Up">{page}</UnauthenticatedLayout>;
};
