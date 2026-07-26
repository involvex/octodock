/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#111827",
          800: "#1f2937",
          700: "#374151",
        },
      },
    },
  },
  plugins: [],
};
