/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // One blue accent with neutral surfaces.
        primary: {
          50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
          400: "#60a5fa", 500: "#007aff", 600: "#0071e3", 700: "#0064ca",
          800: "#004f9e", 900: "#003b76",
        },
        // Accent: warm amber — progress, achievement, certificates, streaks
        accent: {
          50: "#fff8eb",
          100: "#ffedc2",
          200: "#ffdb8a",
          300: "#ffc24d",
          400: "#ffab1f",
          500: "#f28c0f",
          600: "#c96b08",
          700: "#9e500c",
          800: "#7a3f10",
          900: "#5c3110",
        },
        // Success / progress bars
        success: {
          500: "#1f9d6e",
          600: "#17805a",
        },
        surface: {
          light: "#f5f5f7",
          dark: "#101012",
        },
      },
      fontFamily: {
        display: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
