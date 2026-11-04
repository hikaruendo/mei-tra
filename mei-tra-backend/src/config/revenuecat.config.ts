import { registerAs } from '@nestjs/config';

// The webhook cannot work until the secret is configured, but a missing
// secret must not stop the app: monetization ships dark and the rest of the
// backend keeps serving. The controller answers 503 until then.
export default registerAs('revenuecat', () => ({
  webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET?.trim() || null,
}));
