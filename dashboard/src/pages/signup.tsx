import { CircleCheckBig, Code2, Database } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { CookieConsent } from '@/components/common/CookieConsent';
import { UnauthenticatedLayout } from '@/components/layout/UnauthenticatedLayout';
import { Separator } from '@/components/ui/v3/separator';
import { TextLink } from '@/components/ui/v3/text-link';
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
  <div className="grid gap-6">
    <div className="text-center">
      <h2 className="mb-2 font-semibold text-2xl text-foreground">
        Everything you need to ship faster
      </h2>
      <p className="text-muted-foreground text-sm">
        A complete backend stack, ready to use and easy to extend.
      </p>
    </div>

    <div className="grid gap-5 rounded-lg border border-white/10 bg-gradient-to-r from-[#0052CD]/10 to-[#FF02F5]/10 p-5">
      <div className="flex items-center gap-3">
        <CircleCheckBig className="text-foreground" size={20} />
        <p className="font-medium text-foreground text-sm">
          Full backend in 1 minute
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Database className="text-foreground" size={20} />
        <p className="font-medium text-foreground text-sm">
          No infrastructure headaches
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Code2 className="text-foreground" size={20} />
        <p className="font-medium text-foreground text-sm">Easy to extend</p>
      </div>

      <div className="border-white/10 border-t pt-5 text-center">
        <blockquote className="mb-3 text-muted-foreground text-sm italic">
          Nhost has freed us from the tedious tasks of building and maintaining
          our backend infrastructure, allowing us to focus on creating a
          platform that delivers real value to our users.
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#0052CD] to-[#FF02F5]">
            <span className="font-semibold text-foreground text-xs">A</span>
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground text-sm">Alex</p>
            <p className="text-muted-foreground text-xs">CTPO, Yalink</p>
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
      <div className="flex flex-col gap-12 pt-4">
        <div className="text-center">
          <h1 className="mb-3 font-semibold text-3.5xl lg:text-4.5xl">
            Build. Deploy. Scale.
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground text-lg">
            Join thousands of developers building with Nhost
          </p>
        </div>

        <div className="grid grid-flow-row gap-4 rounded-md border bg-transparent p-6 lg:p-12">
          <SignUpWithGithub />

          <div className="relative py-2">
            <p className="absolute top-1/2 right-0 left-0 mx-auto w-12 -translate-y-1/2 bg-background px-2 text-center text-muted-foreground text-sm">
              OR
            </p>

            <Separator />
          </div>
          <SignUpTabs />
          <p className="text-center text-muted-foreground text-sm">
            By signing up, you agree to our{' '}
            <TextLink
              href="https://nhost.io/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              Terms of Service
            </TextLink>{' '}
            and{' '}
            <TextLink
              href="https://nhost.io/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              Privacy Policy
            </TextLink>
          </p>
        </div>
        <div className="rounded-md border bg-transparent p-4 text-center text-base text-muted-foreground lg:text-lg">
          Already have an account?{' '}
          <TextLink href="/signin" className="font-medium">
            Sign In
          </TextLink>
        </div>
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
