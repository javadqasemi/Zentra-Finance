const js = require('@eslint/js');
const html = require('eslint-plugin-html');

module.exports = [
    js.configs.recommended,
    {
        files: ['main.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$' }],
            'no-undef': 'error',
            'eqeqeq': ['warn', 'smart'],
        },
    },
    {
        files: ['src/preload.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-undef': 'error',
        },
    },
    {
        files: ['**/*.html'],
        plugins: { html },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                HTMLElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                AbortController: 'readonly',
                Intl: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                JSON: 'readonly',
                Set: 'readonly',
                Map: 'readonly',
                Promise: 'readonly',
                Image: 'readonly',
                FileReader: 'readonly',
                // CDN globals
                Chart: 'readonly',
                lucide: 'readonly',
                tailwind: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', varsIgnorePattern: '^_' }],
            'no-undef': 'warn',
            'eqeqeq': ['warn', 'smart'],
            'no-redeclare': 'warn',
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'dist-renderer/', 'src/vendor/', '.claude/'],
    },
];
