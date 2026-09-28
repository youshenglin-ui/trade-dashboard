/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 風格 B「淨零跨域」：取自淨零跨域前瞻技術策略交流平台的藍／青色系
      colors: {
        brand: {
          DEFAULT: '#2a5ee8',
          dark: '#1f4fd6',
          soft: '#e9f0ff',
          cyan: '#0fb3d1',
          orange: '#f2994a',
          mint: '#e4f7f0',
          mintInk: '#0b6b4f',
          ink: '#1d2023',
          muted: '#5d6470',
          line: '#e3e8ee',
          ground: '#f4f7f9',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
        num: ['Montserrat', '"Noto Sans TC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
