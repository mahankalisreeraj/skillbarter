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
                    DEFAULT: '#60A5FA', // Sky Blue
                    dark: '#3B82F6',    // Blue 500
                    light: '#93C5FD',   // Blue 300
                },
                secondary: {
                    DEFAULT: '#DBEAFE', // Blue 100
                    dark: '#60A5FA',
                    light: '#EFF6FF',   // Blue 50
                },
                accent: {
                    DEFAULT: '#EFF6FF', // Accent Blue
                    dark: '#DBEAFE',
                },
                surface: {
                    DEFAULT: '#F8FAFC', // Slate 50
                    elevated: '#FFFFFF',
                    dark: '#F1F5F9',    // Slate 100
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
