/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f8f7f4",
        ink: "#1f2a37",
        tide: "#0e7490",
        ember: "#c2410c",
        moss: "#2f5d50",
        slate: "#64748b"
      },
      boxShadow: {
        panel: "0 14px 35px -18px rgba(31, 42, 55, 0.42)"
      }
    }
  },
  plugins: []
};
