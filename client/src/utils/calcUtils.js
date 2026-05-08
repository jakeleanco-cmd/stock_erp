/**
 * 수익률 계산 (세전 - 세금/수수료 미포함)
 */
export const calcGrossReturnRate = (currentPrice, buyPrice) => {
  if (!buyPrice || buyPrice === 0) return 0;
  return parseFloat((((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2));
};

/**
 * 세금/수수료 차감 후 순수익 및 세후 수익률 계산
 */
export const calcNetMetrics = (quantity, buyPrice, currentPrice) => {
  const totalCost = buyPrice * quantity;
  const totalRevenue = currentPrice * quantity;
  const grossProfit = totalRevenue - totalCost;

  // 거래세 0.2% (매도 금액 기준)
  const transactionTax = Math.round(totalRevenue * 0.002);
  // 증권사 수수료 각 0.015% (매입+매도 합산 0.03%)
  const commission = Math.round(totalCost * 0.00015 + totalRevenue * 0.00015);
  
  const netProfit = grossProfit - transactionTax - commission;
  const netReturnRate = totalCost > 0 
    ? parseFloat(((netProfit / totalCost) * 100).toFixed(2)) 
    : 0;

  return {
    grossProfit,
    transactionTax,
    commission,
    netProfit,
    netReturnRate,
    grossReturnRate: calcGrossReturnRate(currentPrice, buyPrice)
  };
};

/**
 * 수익률에 따른 색상 반환
 */
export const getReturnColor = (rate) => {
  if (rate === null || rate === undefined) return '#8c8c8c';
  if (rate > 0) return '#f5222d';   // 상승: 빨강
  if (rate < 0) return '#096dd9';   // 하락: 파랑
  return '#8c8c8c';                 // 보합: 회색
};

/**
 * 숫자를 한국식 금액 문자열로 변환 (예: 1,234,567원)
 */
export const formatKRW = (amount, suffix = '원') => {
  if (amount === null || amount === undefined) return '-';
  return `${amount.toLocaleString('ko-KR')}${suffix}`;
};

/**
 * 수익률 포맷 (부호 포함, 예: +12.50%)
 */
export const formatRate = (rate) => {
  if (rate === null || rate === undefined) return '-';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
};
