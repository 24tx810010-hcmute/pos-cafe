import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F766E",
          soft: "#F0FDFA",
        },
      },
      borderRadius: {
        pos: "8px",
      },
    },
  },
  plugins: [],
} satisfies Config;
