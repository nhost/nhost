import Image from 'next/image';
import NextLink from 'next/link';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { CookieConsent } from '@/components/common/CookieConsent';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Divider } from '@/components/ui/v2/Divider';
import { SignUpTabs } from '@/features/auth/SignUp/SignUpTabs';
import { SignUpWithGithub } from '@/features/auth/SignUp/SignUpWithGithub';

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: gtag
    gtag?: (command: string, ...args: any[]) => void;
    // biome-ignore lint/suspicious/noExplicitAny: gtag
    dataLayer: any[];
  }
}

const rightColumnContent = (
  <div className="grid gap-6 font-[Inter]">
    <div className="text-center">
      <h2 className="mb-2 font-semibold text-2xl text-white">
        Everything you need to ship faster
      </h2>
      <p className="text-[#A2B3BE] text-sm">
        A complete backend stack, ready to use and easy to extend.
      </p>
    </div>

    <div className="grid gap-3">
      <div className="rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-4">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/signup/CircleWavyCheck.svg"
            width={20}
            height={20}
            alt="Check"
          />
          <p className="font-medium text-sm text-white">
            Full backend in 1 minute
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-4">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/database.svg"
            width={20}
            height={20}
            alt="Database"
          />
          <p className="font-medium text-sm text-white">
            No infrastructure headaches
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-4">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/functions/ts.svg"
            width={20}
            height={20}
            alt="Functions"
          />
          <p className="font-medium text-sm text-white">Easy to extend</p>
        </div>
      </div>
    </div>

    <div className="rounded-lg border border-white/5 bg-gradient-to-br from-[#0052CD]/5 to-[#FF02F5]/5 p-5">
      <div className="text-center">
        <blockquote className="mb-3 text-sm text-white italic">
          Nhost has freed us from the tedious tasks of building and maintaining
          our backend infrastructure, allowing us to focus on creating a
          platform that delivers real value to our users.
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#0052CD] to-[#FF02F5]">
            <span className="font-semibold text-white text-xs">A</span>
          </div>
          <div className="text-left">
            <p className="font-medium text-sm text-white">Alex</p>
            <p className="text-[#68717A] text-xs">CTPO, Yalink</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function SignUpPage() {
  const initializeGoogleAds = useCallback(() => {
    if (window.gtag) {
      return;
    }
    window.dataLayer = window.dataLayer || [];
    // biome-ignore lint/suspicious/noExplicitAny: gtag
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
      <div className="flex flex-col gap-12 pt-4 font-[Inter]">
        <div className="text-center">
          <h1 className="mb-3 font-semibold text-3.5xl lg:text-4.5xl">
            Build. Deploy. Scale.
          </h1>
          <p className="mx-auto max-w-md text-[#A2B3BE] text-lg">
            Join thousands of developers building with Nhost
          </p>
        </div>

        <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
          <SignUpWithGithub />

          <div className="relative py-2">
            <p className="absolute top-1/2 right-0 left-0 mx-auto w-12 -translate-y-1/2 bg-black px-2 text-center text-[#68717A] text-sm">
              OR
            </p>

            <Divider />
          </div>
          <SignUpTabs />
          <Divider className="!my-2" />
          <p className="text-center text-[#A2B3BE] text-sm">
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
        <p className="text-center text-[#A2B3BE] text-base lg:text-lg">
          Already have an account?{' '}
          <NextLink href="/signin" className="font-medium text-white">
            Sign In
          </NextLink>
        </p>
      </div>

      <CookieConsent onAccept={initializeGoogleAds} />
    </>
  );
}

SignUpPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <UnauthenticatedLayout
      title="Sign Up"
      rightColumnContent={rightColumnContent}
    >
      {page}
    </UnauthenticatedLayout>
  );
};
