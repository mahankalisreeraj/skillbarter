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
                    DEFAULT: '#f05b72', // Coral Pink
                    dark: '#d14a5d',
                    light: '#f48091',
                },
                secondary: {
                    DEFAULT: '#fba063', // Sunset Orange
                    dark: '#e08a4d',
                    light: '#fdb88b',
                },
                accent: {
                    DEFAULT: '#ffd25e', // Golden Yellow
                    dark: '#e6bd4d',
                },
                surface: {
                    DEFAULT: '#2d5a27', // Forest Teal
                    elevated: '#3a7231',
                    dark: '#1e293b', // Deep Slate for background
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
