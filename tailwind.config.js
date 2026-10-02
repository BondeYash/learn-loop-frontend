/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Teal from the supplied reference, with accessible text/button shades.
        primary: {
          50: "#effbf8", 100: "#d5f4ec", 200: "#ace9dd", 300: "#76d8c8",
          400: "#48bfb5", 500: "#24a99e", 600: "#087e76", 700: "#06665f",
          800: "#0a514c", 900: "#103d39",
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
          light: "#f7faf9",
          dark: "#101a1b",
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
