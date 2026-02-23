/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#c084fc', // Purple 400
                    dark: '#a855f7',    // Purple 500
                    light: '#e9d5ff',   // Purple 200
                },
                secondary: {
                    DEFAULT: '#d8b4fe', // Purple 300
                    dark: '#c084fc',
                    light: '#f3e8ff',   // Purple 100
                },
                accent: {
                    DEFAULT: '#f3e8ff', // Very light purple
                    dark: '#d8b4fe',
                },
                surface: {
                    DEFAULT: '#1e1b4b', // Deep Indigo (Indigo 900)
                    elevated: '#312e81', // Indigo 800
                    dark: '#0b0a1a',    // Very dark violet-black
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
