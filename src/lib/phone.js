export const PHONE_EMAIL_DOMAIN = 'phone.viecnhanh.local';

export function parseVnPhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return null;

  let national = digits;
  if (national.startsWith('84')) national = national.slice(2);
  else if (national.startsWith('0')) national = national.slice(1);

  if (national.length < 9 || national.length > 10) return null;

  const e164 = `+84${national}`;
  return {
    e164,
    national: `0${national}`,
    digits: `84${national}`,
    email: `84${national}@${PHONE_EMAIL_DOMAIN}`,
  };
}

export function isPhoneAliasEmail(email) {
  return String(email || '').toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

export function displayPhone(phone) {
  const parsed = parseVnPhone(phone);
  if (!parsed) return phone || '';
  const n = parsed.national;
  if (n.length === 10) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return n;
}
