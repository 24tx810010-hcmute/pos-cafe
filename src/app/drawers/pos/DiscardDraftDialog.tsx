import { Button } from "@mui/material";
import { PortalPopup } from "../../components/PortalPopup";

export function DiscardDraftDialog({ onKeep, onDiscard }: { onKeep(): void; onDiscard(): void }) {
  return <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50">
    <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted">
      <h3>Bỏ đơn chưa gửi?</h3><p>Các món vừa chọn sẽ không được lưu.</p>
      <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
        <Button variant="outlined" onClick={onKeep}>Tiếp tục chỉnh sửa</Button>
        <Button variant="contained" color="error" onClick={onDiscard}>Bỏ đơn</Button>
      </div>
    </div>
  </PortalPopup>;
}
