export const PUSH_GROUPS = {
  listing: 'listing',
  wallet: 'wallet',
  jobs: 'jobs',
  promo: 'promo',
};

export const PUSH_CHANNELS = {
  listing: 'viecnhanh-listing',
  wallet: 'viecnhanh-wallet',
  jobs: 'viecnhanh-jobs',
  promo: 'viecnhanh-promo',
};

export const NOTIFY_DEFAULTS = {
  notify_push: true,
  notify_wallet: true,
  notify_new_bids: true,
  notify_messages: true,
  notify_hired: true,
  notify_hire_cancelled: true,
  notify_reviews: true,
  notify_promo: true,
  notify_new_jobs: true,
};

export const LISTING_NOTIFY_KEYS = [
  'notify_new_bids',
  'notify_messages',
  'notify_hired',
  'notify_hire_cancelled',
  'notify_reviews',
];

export function notifyFlag(profile, key) {
  if (!profile || profile[key] == null) return NOTIFY_DEFAULTS[key] !== false;
  return Boolean(profile[key]);
}
