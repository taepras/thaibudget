/**
 * Abbreviates a number with Thai numbering system
 * Examples:
 * - 3456789 → "3.46 ล้านบาท"
 * - 123456 → "123 พันบาท"
 * - 12345 → "12.3 พันบาท"
 * - 1234 → "1,234 บาท"
 * @param {number} num - The number to abbreviate
 * @returns {string} Abbreviated number with Thai suffix
 */
export function abbreviateNumber(num) {
  if (!num || num === 0) return '0 บาท';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  let suffix = 'บาท';
  let divisor = 1;

  // if (absNum >= 1e12) {
  //   suffix = 'T บาท';
  //   divisor = 1e12;
  // } else
  if (absNum >= 1e9) {
    suffix = 'B บาท';
    divisor = 1e9;
  } else if (absNum >= 1e6) {
    suffix = 'M บาท';
    divisor = 1e6;
  } else if (absNum >= 1000) {
    suffix = 'k บาท';
    divisor = 1000;
  }

  // if (absNum >= 1e12) {
  //   suffix = 'ล้านล้านบาท';
  //   divisor = 1e12;
  // } else if (absNum >= 1e11) {
  //   suffix = 'แสนล้านบาท';
  //   divisor = 1e11;
  // } else if (absNum >= 1e10) {
  //   suffix = 'หมื่นล้านบาท';
  //   divisor = 1e10;
  // } else if (absNum >= 1e9) {
  //   suffix = 'พันล้านบาท';
  //   divisor = 1e9;
  // } else if (absNum >= 1e8) {
  //   suffix = 'ร้อยล้านบาท';
  //   divisor = 1e8;
  // } else if (absNum >= 1e7) {
  //   suffix = 'สิบล้านบาท';
  //   divisor = 1e7;
  // } else if (absNum >= 1e6) {
  //   suffix = 'ล้านบาท';
  //   divisor = 1e6;
  // } else if (absNum >= 1e5) {
  //   suffix = 'แสนบาท';
  //   divisor = 1e5;
  // } else if (absNum >= 1e4) {
  //   suffix = 'หมื่นบาท';
  //   divisor = 1e4;
  // } else if (absNum >= 1000) {
  //   suffix = 'พันบาท';
  //   divisor = 1000;
  // }

  const abbreviated = absNum / divisor;

  // Format with up to 2 decimal places, removing trailing zeros
  let formatted;
  if (abbreviated >= 100) {
    // For numbers >= 100, use whole number
    formatted = Math.round(abbreviated).toLocaleString();
  } else if (abbreviated >= 10) {
    // For numbers 10-99, use 1 decimal place
    formatted = (abbreviated).toFixed(1);
  } else {
    // For numbers < 10, use 2 decimal places
    formatted = (abbreviated).toFixed(2);
  }

  return `${sign}${formatted}${suffix}`;
}

/**
 * Formats a number with locale-specific thousand separators
 * @param {number} num - The number to format
 * @returns {string} Formatted number with commas
 */
export function formatNumberWithCommas(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString();
}
