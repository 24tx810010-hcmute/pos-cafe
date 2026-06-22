import plugin from "tailwindcss/plugin";

const posBaseStyles = {
  ":root": {
    "--primary": "#0f766e",
    "--primary-soft": "#f0fdfa",
    "--primary-line": "#99f6e4",
    "--bg": "#f5f7fa",
    "--surface": "#ffffff",
    "--surface-2": "#f8fafc",
    "--line": "#d7dee8",
    "--ink": "#172033",
    "--muted": "#657286",
    "--success": "#15803d",
    "--warning": "#b45309",
    "--danger": "#b91c1c",
    "--rail": "#f8fbfb",
    "color": "var(--ink)",
    "background": "var(--bg)",
    "font-family": "Inter, \"Segoe UI\", Arial, sans-serif"
  },
  "html, body, #root": {
    "width": "100%",
    "height": "100%",
    "margin": "0",
    "overflow": "hidden"
  },
  "button, input, textarea": {
    "font": "inherit"
  },
  "@keyframes pin-shake": {
    "0%, 100%": {
      "transform": "translateX(0)"
    },
    "20%": {
      "transform": "translateX(-6px)"
    },
    "40%": {
      "transform": "translateX(6px)"
    },
    "60%": {
      "transform": "translateX(-4px)"
    },
    "80%": {
      "transform": "translateX(4px)"
    }
  },
  "@keyframes skeleton-shimmer": {
    "0%": {
      "background-position": "200% 0"
    },
    "100%": {
      "background-position": "-200% 0"
    }
  }
};

export const posCafeStyles = plugin(({ addBase }) => {
  addBase(posBaseStyles);
});
