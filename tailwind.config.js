/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alien-green': '#39FF14',
        'bilu-purple': '#9D00FF',
        'deep-bg': '#050505',
        'card-bg': '#121212',
        'bilu-alert': '#FF6B35',
      },
    },
  },
  plugins: [],
}
