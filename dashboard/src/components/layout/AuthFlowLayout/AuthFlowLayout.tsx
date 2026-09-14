import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';

export interface AuthFlowLayoutProps extends Omit<BaseLayoutProps, 'className'> {
  rightColumnContent?: ReactNode;
}

/**
 * The sign-in / sign-up / verification flow: forced dark, full viewport, the
 * form on the left and the brand column on the right. Whether the visitor may
 * see it is `GuestGuard`'s business.
 */
export default function AuthFlowLayout({
  children,
  rightColumnContent,
  ...props
}: AuthFlowLayoutProps) {
  return (
    <BaseLayout {...props}>
      <div className="dark h-screen overflow-auto bg-black text-foreground">
        <RetryableErrorBoundary>
          <div className="flex min-h-screen items-center bg-black">
            <Container
              rootClassName="bg-transparent h-full"
              className="grid h-full w-full items-center justify-items-center gap-12 bg-transparent pt-8 pb-12 lg:grid-cols-2 lg:gap-4 lg:pt-8 lg:pb-0"
            >
              <div className="relative z-10 order-2 grid w-full max-w-[544px] grid-flow-row gap-12 lg:order-1">
                {children}
              </div>

              <div className="relative z-0 order-1 flex h-full w-full flex-col items-center justify-center md:min-h-[150px] lg:order-2 lg:min-h-[none] lg:gap-8">
                <div className="relative flex items-center justify-center">
                  <div className="absolute top-0 right-0 bottom-0 left-0 mx-auto flex h-full w-full max-w-xl items-center justify-center overflow-hidden opacity-70">
                    <Image
                      priority
                      src="/assets/line-grid.svg"
                      width={1003}
                      height={644}
                      alt="Transparent lines"
                      objectFit="fill"
                      className="h-full w-full scale-[200%]"
                    />
                  </div>

                  <div className="backface-hidden absolute right-0 left-0 z-0 mx-auto h-20 w-20 transform-gpu rounded-full bg-primary-main opacity-80 blur-[56px]" />

                  <Image
                    src="/assets/logo.svg"
                    width={119}
                    height={40}
                    alt="Nhost Logo"
                  />
                </div>

                {rightColumnContent && (
                  <div className="relative z-10 w-full max-w-md px-4 lg:px-0">
                    {rightColumnContent}
                  </div>
                )}
              </div>
            </Container>
          </div>
        </RetryableErrorBoundary>
      </div>
    </BaseLayout>
  );
}
