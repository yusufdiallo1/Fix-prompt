/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        syne:      ["Syne", "sans-serif"],
        dm:        ["DM Sans", "sans-serif"],
        cormorant: ["Cormorant Garamond", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
