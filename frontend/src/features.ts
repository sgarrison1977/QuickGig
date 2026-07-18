/**
 * Runtime feature flags for QuickGig.
 *
 * v1.0.1 (initial Google Play launch): monetization is DISABLED.
 * Google Play policy requires digital in-app purchases (Pro subscription,
 * Boosts, Background-Check badges) to be sold through Google Play Billing.
 * Our current backend only supports Stripe. To avoid a policy-violation
 * rejection, we hide every entry point in the UI and only re-enable
 * monetization after Play Billing is integrated in v1.1.
 *
 * The backend Stripe endpoints stay wired up (they're needed for the
 * web/iOS TestFlight paths and for the eventual Play Billing bridge),
 * we simply don't surface them to users on the mobile shipping build.
 *
 * When you're ready to re-enable, flip this flag to `true` and rebuild.
 */
export const MONETIZATION_ENABLED = false;
