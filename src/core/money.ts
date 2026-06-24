export const formatVnd = (amount: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

// Dạng gọn không khoảng trắng, hậu tố "đ" (vd "29.000đ") cho list/receipt.
export const formatVndShort = (amount: number): string =>
  formatVnd(amount).replace(/\s/g, "").replace("₫", "đ");

export const formatCompactVnd = (amount: number): string => {
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}K`;
  }

  return `${amount}đ`;
};
