/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      primary: { 50: "#F0F3FF", 100: "#E5EBFF", 200: "#CED9FF", 300: "#AEBEFF", 400: "#8295FF", 500: "#596DFF", 600: "#3346FF", 700: "#2535D2", 800: "#2230A5", 900: "#202D7B", 950: "#151D45" },
      accent: { 50: "#FFF8EB", 100: "#FCE8BC", 200: "#FFD78A", 300: "#F7B54A", 400: "#EFA22E", 500: "#D58A18", 600: "#B26B0E", 700: "#8A4C0B", 800: "#6B390D", 900: "#512D12" },
      slate: { 50: "#F5F8F1", 100: "#EAF0E8", 200: "#D7E0D6", 300: "#C0CEC0", 400: "#9BAF9F", 500: "#687D6F", 600: "#5C665F", 700: "#3F5147", 800: "#243832", 900: "#18221F", 950: "#111B1A" },
      success: { 500: "#18815D", 600: "#116747" },
      surface: { light: "#F7F7F0", dark: "#111B1A" },
      ink: "var(--ink)", muted: "var(--muted)", panel: "var(--panel)", soft: "var(--soft)", line: "var(--line)",
      mango: "#F7B54A", lime: "#D7F863", lilac: "#DDE5FF", candy: "#FFB9C7", cyan: "#7CE0D6",
    },
    fontFamily: { display: ["'Plus Jakarta Sans'", "'Noto Sans Devanagari'", "system-ui", "sans-serif"], body: ["'Plus Jakarta Sans'", "'Noto Sans Devanagari'", "system-ui", "sans-serif"] },
    borderRadius: { xl: "0.75rem", "2xl": "1.25rem", "3xl": "1.75rem" },
  } }, plugins: [],
};
