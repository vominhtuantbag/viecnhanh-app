export const FALLBACK_WHEEL = [
  { id: 'fallback-wheel-50', prizeName: '50 xu', prizeType: 'coin', value: 50, probability: 40 },
  { id: 'fallback-wheel-100', prizeName: '100 xu', prizeType: 'coin', value: 100, probability: 30 },
  { id: 'fallback-wheel-200', prizeName: '200 xu', prizeType: 'coin', value: 200, probability: 18 },
  { id: 'fallback-wheel-500', prizeName: '500 xu', prizeType: 'coin', value: 500, probability: 9 },
  { id: 'fallback-wheel-1000', prizeName: '1000 xu', prizeType: 'coin', value: 1000, probability: 3 },
];

export const FALLBACK_BOX = [
  { id: 'fallback-box-200', prizeName: '200 xu', prizeType: 'coin', value: 200, probability: 50 },
  { id: 'fallback-box-500', prizeName: '500 xu', prizeType: 'coin', value: 500, probability: 30 },
  { id: 'fallback-box-1000', prizeName: '1000 xu', prizeType: 'coin', value: 1000, probability: 15 },
  { id: 'fallback-box-2000', prizeName: '2000 xu', prizeType: 'coin', value: 2000, probability: 5 },
];

export function prizeSentence(result) {
  if (!result) return '';
  if (result.prizeType === 'coin') {
    const amount = new Intl.NumberFormat('vi-VN').format(Number(result.value) || 0);
    return `Bạn nhận ${amount} xu.`;
  }
  if (result.prizeType === 'voucher') return `Bạn nhận voucher ${result.prizeName}.`;
  return `Bạn nhận ${result.prizeName}.`;
}
