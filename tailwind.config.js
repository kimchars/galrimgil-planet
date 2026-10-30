/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        hud: ['Orbitron', 'Noto Sans KR', 'system-ui', 'sans-serif'],
        display: ['"Black Han Sans"', 'Noto Sans KR', 'system-ui', 'sans-serif'],
        body: ['"Noto Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        warp: { from: { transform: 'scale(0.6) rotate(0deg)', opacity: '0' }, '30%': { opacity: '1' }, to: { transform: 'scale(2.4) rotate(40deg)', opacity: '0.9' } },
        scan: { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(100%)' } },
        glow: { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.8,.2,1) both',
        warp: 'warp 1.6s cubic-bezier(.5,0,.2,1) forwards',
        scan: 'scan 2.4s linear infinite',
        glow: 'glow 2.2s ease-in-out infinite',
        blink: 'blink 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
