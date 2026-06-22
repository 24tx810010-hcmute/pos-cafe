export const formatVnd = (amount: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

export const formatCompactVnd = (amount: number): string => {
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}K`;
  }

  return `${amount}đ`;
};
