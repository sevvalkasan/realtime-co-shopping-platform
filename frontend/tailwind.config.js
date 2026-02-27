/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}", // Pages klasörünü açıkça ekledik
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}