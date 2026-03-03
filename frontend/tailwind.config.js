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
                    DEFAULT: '#F5AFAF', // Soft Coral Pink
                    dark: '#E89393',    // Darker pink
                    light: '#FACBCB',   // Lighter pink
                },
                secondary: {
                    DEFAULT: '#F9DFDF', // Light Pink
                    dark: '#F5AFAF',
                    light: '#FBEFEF',   // Very Light Pink
                },
                accent: {
                    DEFAULT: '#FBEFEF', // Accent Pink
                    dark: '#F9DFDF',
                },
                surface: {
                    DEFAULT: '#FCF8F8', // Main Surface (White-Pink)
                    elevated: '#FFFFFF',
                    dark: '#F7F2F2',    // Background Dark
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
