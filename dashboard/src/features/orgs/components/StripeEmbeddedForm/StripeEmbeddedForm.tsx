import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';

loadStripe.setLoadParameters({ advancedFraudSignals: false });

let stripePromise: Promise<Stripe | null> | null = null;

// Loaded on first render, not on import: the header imports this module on
// every page, including in CLI and self-hosted mode, but only checkout needs
// Stripe.js. The promise is cached because the provider needs a stable prop.
function getStripe() {
  if (!stripePromise && process.env.NEXT_PUBLIC_STRIPE_PK) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK);
  }

  return stripePromise;
}

export default function StripeEmbeddedForm({
  clientSecret,
}: {
  clientSecret: string;
}) {
  return (
    <div className="h-[80vh] overflow-y-scroll">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{
          clientSecret,
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
