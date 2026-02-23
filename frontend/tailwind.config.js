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
                    DEFAULT: '#8b5cf6', // Violet 500
                    dark: '#7c3aed',    // Violet 600
                    light: '#a78bfa',   // Violet 400
                },
                secondary: {
                    DEFAULT: '#ec4899', // Pink 500
                    dark: '#db2777',    // Pink 600
                    light: '#fb7185',   // Rose 400
                },
                accent: {
                    DEFAULT: '#06b6d4', // Cyan 500
                    dark: '#0891b2',    // Cyan 600
                },
                surface: {
                    DEFAULT: '#0f172a', // Slate 900
                    elevated: '#1e293b', // Slate 800
                    dark: '#020617',    // Slate 950
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
