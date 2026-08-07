/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy aliases (keep for backward compat with existing pages)
        canvas: "#f8f7f4",
        ink: "#1f2a37",
        tide: "#0e7490",
        ember: "#c2410c",
        moss: "#2f5d50",
        slate: "#64748b",
        "warm-canvas": "#F7F4EC",
        "panel-white": "#FFFFFF",
        "op-teal": "#087E8B",
        "op-cyan": "#2B9EAC",
        critical: "#B42318",
        success: "#147D64",
        muted: "#5C6975",
        pending: "#B25F00",
        navy: "#0B1F33",
        // Modern semantic tokens
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      boxShadow: {
        panel: "0 14px 35px -18px rgba(31, 42, 55, 0.42)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        "card-hover": "0 8px 25px -8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.04)",
        glow: "0 0 20px rgba(99,102,241,0.15)",
        "inner-line": "inset 0 0 0 1px rgba(0,0,0,0.04)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
    },
  },
  plugins: []
};
