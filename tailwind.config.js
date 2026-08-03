/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.js"
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': 'var(--bg-dark)',
        'bg-canvas': 'var(--bg-canvas)',
        'panel-bg': 'var(--panel-bg)',
        'panel-border': 'var(--panel-border)',
        'card-bg': 'var(--card-bg)',
        'card-header': 'var(--card-header)',
        'accent-blue': 'var(--accent-blue)',
        'accent-purple': 'var(--accent-purple)',
        'accent-green': 'var(--accent-green)',
        'accent-amber': 'var(--accent-amber)',
        'accent-rose': 'var(--accent-rose)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'line-color': 'var(--line-color)',
        'line-glow': 'var(--line-glow)',
      }
    },
  },
  plugins: [],
}
