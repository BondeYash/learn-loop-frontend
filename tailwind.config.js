/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      primary: { 50: "#F3EDFF", 100: "#E9DFFF", 200: "#D8C7FF", 300: "#BEA0FF", 400: "#A586EE", 500: "#865CDD", 600: "#5D37C8", 700: "#4B28AF", 800: "#3B2087", 900: "#291957" },
      accent: { 50: "#FFF8EB", 100: "#FCE8BC", 200: "#FFD78A", 300: "#F7B54A", 400: "#EFA22E", 500: "#D58A18", 600: "#B26B0E", 700: "#8A4C0B", 800: "#6B390D", 900: "#512D12" },
      slate: { 50: "#F8F5FB", 100: "#F0EBF5", 200: "#E0D7E8", 300: "#D0C4DB", 400: "#ADA1BC", 500: "#73677F", 600: "#625C70", 700: "#4D465C", 800: "#302A43", 900: "#262238", 950: "#191724" },
      success: { 500: "#18815D", 600: "#116747" },
      surface: { light: "#FFF9EF", dark: "#191724" },
      ink: "var(--ink)", muted: "var(--muted)", panel: "var(--panel)", soft: "var(--soft)", line: "var(--line)",
      mango: "#F7B54A", lime: "#DDF28F", lilac: "#D8C7FF", candy: "#F7BFD7", cyan: "#61D6E3",
    },
    fontFamily: { display: ["'Baloo 2'", "'Noto Sans Devanagari'", "system-ui", "sans-serif"], body: ["'Plus Jakarta Sans'", "'Noto Sans Devanagari'", "system-ui", "sans-serif"] },
    borderRadius: { xl: "0.75rem", "2xl": "1.25rem", "3xl": "1.75rem" },
  } }, plugins: [],
};
