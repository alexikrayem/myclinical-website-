export const PHONE_CONFIG = {
  countryCode: '963',
  localPrefix: '09',
  regex: /^(\+?963|0)?9\d{8}$/,
  example: '0912345678'
};

export const cleanPhoneNumber = (phone = '') => {
  const str = String(phone);
  const digitsOnly = str.replace(/[^\d]/g, '');
  return str.startsWith('+') ? '+' + digitsOnly : digitsOnly;
};

export const isValidPhoneNumber = (phone) => {
  const cleaned = cleanPhoneNumber(phone);
  // Accept Syrian format: 09xxxxxxxx or +963xxxxxxxxx or 963xxxxxxxxx
  const syrianRegex = /^(\+?963|0)?9\d{8}$/;
  return syrianRegex.test(cleaned);
};

export const normalizePhoneNumber = (phone) => {
  const cleaned = cleanPhoneNumber(phone);
  // Convert all to 09xxxxxxxx format
  if (cleaned.startsWith('+963')) {
    return '0' + cleaned.substring(4);
  }
  if (cleaned.startsWith('963')) {
    return '0' + cleaned.substring(3);
  }
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    return '0' + cleaned;
  }
  return cleaned;
};
