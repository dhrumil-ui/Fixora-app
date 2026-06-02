// frontend/src/app/lib/stripe.ts
import { loadStripe, Stripe } from "@stripe/stripe-js";

const PUBLIC_KEY =
  ((import.meta as any).env?.VITE_STRIPE_PUBLIC_KEY as string) || "";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!PUBLIC_KEY) {
    console.warn("⚠️ VITE_STRIPE_PUBLIC_KEY not set — Stripe disabled");
    return Promise.resolve(null);
  }

  if (!stripePromise) {
    stripePromise = loadStripe(PUBLIC_KEY);
  }
  return stripePromise;
}
