/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          dark: '#3B82F6',
          'dark-hover': '#60A5FA',
        },
        sidebar: {
          DEFAULT: '#1E293B',
          dark: '#020617',
          text: '#E2E8F0',
          'selected-bg': '#334155',
          'dark-selected-bg': '#1E40AF',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          dark: '#0F172A',
          card: '#FFFFFF',
          'card-dark': '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Microsoft YaHei', 'PingFang SC', 'sans-serif'],
        mono: ['Consolas'],
      },
    },
  },
  plugins: [],
}
