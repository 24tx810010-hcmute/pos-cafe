import { Button } from "@mui/material";
import type { ReactNode } from "react";
import { useAppStore } from "../useAppStore";
import { PortalDrawer } from "./PortalDrawer";

type EditorDrawerProps = {
  title: string;
  subtitle: string;
  testId: string;
  children: ReactNode;
};

export function EditorDrawer({ title, subtitle, testId, children }: EditorDrawerProps) {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  return (
    <PortalDrawer testId={testId} onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
      </header>
      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2">{children}</div>
    </PortalDrawer>
  );
}
