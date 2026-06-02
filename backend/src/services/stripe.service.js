import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set in .env - Stripe disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
    typescript: false,
  })
  : null;

/**
 * Create a Payment Intent in Stripe
 * @param {object} params - amount, currency, metadata
 * @returns Stripe PaymentIntent object
 */
export async function createPaymentIntent({
  amount,
  currency = "usd",
  metadata = {},
  customerId = null,
  description = "Fixora service booking",
}) {
  if (!stripe) throw new Error("Stripe not configured");

  // Stripe expects amount in cents (multiply by 100)
  const amountInCents = Math.round(Number(amount) * 100);

  if (amountInCents < 50) {
    throw new Error("Amount must be at least $0.50");
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    metadata,
    description,
    payment_method_types: ["card"],
  });

  return intent;
}

/**
 * Retrieve a Payment Intent
 */
export async function retrievePaymentIntent(intentId) {
  if (!stripe) throw new Error("Stripe not configured");
  return await stripe.paymentIntents.retrieve(intentId);
}

/**
 * Refund a payment
 */
export async function refundPayment(paymentIntentId, amountInCents = null) {
  if (!stripe) throw new Error("Stripe not configured");

  const refundParams = { payment_intent: paymentIntentId };
  if (amountInCents) refundParams.amount = amountInCents;

  return await stripe.refunds.create(refundParams);
}

/**
 * Verify webhook signature - critical for security
 * @param {Buffer} rawBody - raw request body (NOT parsed JSON)
 * @param {string} signature - value of stripe-signature header
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!stripe) throw new Error("Stripe not configured");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}