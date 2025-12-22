import { build } from 'vite'
import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Build content.js as IIFE (required for Chrome Extension content scripts)
// Use string input instead of object to ensure single input
const contentConfig = defineConfig({
  plugins: [],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        name: 'Sys2PathContent',
        inlineDynamicImports: true, // Required for IIFE with single input
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    emptyOutDir: false // Don't empty, we'll build other files separately
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})

build(contentConfig).then(() => {
  console.log('✅ Content script built as IIFE')
}).catch((err) => {
  console.error('❌ Failed to build content script:', err)
  process.exit(1)
})

