/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs"],
  theme: {
    extend: {
      colors: {
        'lps-orange': '#D98727',
        'lps-orange-light': '#F5A623',
        'lps-blue': '#12239E',
        'lps-blue-light': '#1E3A8A',
      }
    },
  },
  plugins: [],
}

