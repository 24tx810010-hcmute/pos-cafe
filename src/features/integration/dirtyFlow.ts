export type DirtyExitDecision = "allow" | "confirmDiscard" | "blockWhileSaving";

export type DirtyExitInput = {
  isDirty: boolean;
  isSaving?: boolean;
};

export type SaveFeedbackKind = "success" | "error";

export type SaveFeedback = {
  kind: SaveFeedbackKind;
  title: string;
  message: string;
};

const SURFACE_LABELS = {
  employee: "nhân viên",
  floorPlan: "sơ đồ bàn",
  menu: "menu",
  settings: "cài đặt",
} as const;

export type SaveSurface = keyof typeof SURFACE_LABELS;

export const getDirtyExitDecision = (input: DirtyExitInput): DirtyExitDecision => {
  if (input.isSaving) {
    return "blockWhileSaving";
  }

  return input.isDirty ? "confirmDiscard" : "allow";
};

export const createSaveFeedback = (surface: SaveSurface, kind: SaveFeedbackKind): SaveFeedback => {
  const surfaceLabel = SURFACE_LABELS[surface];

  if (kind === "success") {
    return {
      kind,
      title: "Đã lưu",
      message: `Thay đổi ${surfaceLabel} đã được lưu.`,
    };
  }

  return {
    kind,
    title: "Chưa lưu được",
    message: `Thay đổi ${surfaceLabel} chưa được lưu. Hãy thử lại.`,
  };
};
