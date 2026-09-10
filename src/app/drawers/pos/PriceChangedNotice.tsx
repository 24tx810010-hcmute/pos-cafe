import { Button } from "@mui/material";
import type { MenuCatalog, PriceChangedDetails, SubmitOrderDraftItem } from "@/domain";
import { formatVnd } from "@/core/money";

type Props = { priceChanged: PriceChangedDetails; draftItems: SubmitOrderDraftItem[]; menu?: MenuCatalog;
  setDraftItems(items: SubmitOrderDraftItem[]): void; onReviewed(): void };
export function PriceChangedNotice({ priceChanged, draftItems, menu, setDraftItems, onReviewed }: Props) {
  return (
      <div role="alert" data-testid="price-changed-review" className="m-3 rounded border border-amber-400 p-3">
        <p>Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại.</p>
        {priceChanged.lines.map((line) => <div key={line.lineId}>{draftItems.find((item) => item.id === line.lineId)?.snapshotName ?? line.lineId}: {formatVnd(line.base.quoted)} → {formatVnd(line.base.current)}{line.options.map((option) => <div key={option.optionValueId}>{menu?.optionValues.find((value) => value.id === option.optionValueId)?.name ?? option.optionValueId}: {formatVnd(option.quoted)} → {formatVnd(option.current)}</div>)}</div>)}
        <p>Tổng phần gọi thêm theo giá mới: {formatVnd(priceChanged.proposedNewLinesTotal)}. Các phần đã lưu giữ nguyên giá.</p>
        <Button onClick={() => {
          setDraftItems(draftItems.map((item) => {
            if (item.sourceItemId) return item;
            const price = priceChanged.lines.find((line) => line.lineId === item.id);
            return !price ? item : { ...item, quotedBasePrice: price.base.current, options: item.options.map((option) => ({ ...option, quotedPriceDelta: price.options.find((entry) => entry.optionValueId === option.optionValueId)?.current ?? option.quotedPriceDelta })) };
          }));
          onReviewed();
        }}>Dùng giá mới để kiểm tra lại giỏ</Button>
      </div>
  );
}
