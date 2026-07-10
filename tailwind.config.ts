import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          low: "#16a34a",
          moderate: "#ca8a04",
          high: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
