import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chrome-extension-build',
      writeBundle() {
        // Copy manifest.json
        if (existsSync('public/manifest.json')) {
          copyFileSync('public/manifest.json', 'dist/manifest.json')
          console.log('✅ Copied manifest.json')
        }

        // Copy sidebar HTML and fix paths
        // Look for sidebar.html in assets directory (Vite may place it there)
        const sidebarHtmlPaths = [
          'dist/src/sidebar/index.html',
          'dist/assets/sidebar.html',
          'dist/sidebar.html'
        ]
        let sidebarHtmlPath = sidebarHtmlPaths.find(path => existsSync(path))
        if (sidebarHtmlPath && sidebarHtmlPath !== 'dist/sidebar.html') {
          copyFileSync(sidebarHtmlPath, 'dist/sidebar.html')
          let sidebarContent = readFileSync('dist/sidebar.html', 'utf8')
          // Fix script and style paths
          sidebarContent = sidebarContent.replace(/src="\/sidebar\.js"/g, 'src="./sidebar.js"')
          sidebarContent = sidebarContent.replace(/href="\/assets\/([^"]+)\.css"/g, 'href="./assets/$1.css"')
          // Fix chunk paths
          sidebarContent = sidebarContent.replace(/src="\/chunks\//g, 'src="./chunks/')
          sidebarContent = sidebarContent.replace(/href="\/chunks\//g, 'href="./chunks/')
          writeFileSync('dist/sidebar.html', sidebarContent)
          console.log('✅ Copied and fixed sidebar.html')
        }

        // Copy dashboard HTML and fix paths
        const dashboardHtmlPaths = [
          'dist/src/dashboard/index.html',
          'dist/assets/dashboard.html',
          'dist/dashboard.html'
        ]
        let dashboardHtmlPath = dashboardHtmlPaths.find(path => existsSync(path))
        if (dashboardHtmlPath && dashboardHtmlPath !== 'dist/dashboard.html') {
          copyFileSync(dashboardHtmlPath, 'dist/dashboard.html')
          let dashboardContent = readFileSync('dist/dashboard.html', 'utf8')
          // Fix script and style paths
          dashboardContent = dashboardContent.replace(/src="\/dashboard\.js"/g, 'src="./dashboard.js"')
          dashboardContent = dashboardContent.replace(/href="\/assets\/([^"]+)\.css"/g, 'href="./assets/$1.css"')
          // Fix chunk paths
          dashboardContent = dashboardContent.replace(/src="\/chunks\//g, 'src="./chunks/')
          dashboardContent = dashboardContent.replace(/href="\/chunks\//g, 'href="./chunks/')
          writeFileSync('dist/dashboard.html', dashboardContent)
          console.log('✅ Copied and fixed dashboard.html')
        }

        // No cleanup needed - all files are now in IIFE format

        // Update manifest.json web accessible resources
        if (existsSync('dist/manifest.json')) {
          const manifestContent = readFileSync('dist/manifest.json', 'utf8')
          const manifest = JSON.parse(manifestContent)
          
          if (manifest.web_accessible_resources && manifest.web_accessible_resources[0]) {
            manifest.web_accessible_resources[0].resources = [
              'sidebar.html',
              'sidebar.js',
              'sidebar.css',
              'dashboard.html',
              'dashboard.js',
              'dashboard.css'
            ]
          }
          
          writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2))
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html')
        // Note: content.js is built separately as IIFE (see build-content.js)
      },
      output: {
        // Use ES module format for background and sidebar
        format: 'es',
        entryFileNames: (chunkInfo: { name: string }) => {
          if (chunkInfo.name === 'sidebar') {
            return 'sidebar.js'
          }
          if (chunkInfo.name === 'dashboard') {
            return 'dashboard.js'
          }
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    emptyOutDir: true // Will be emptied by first build, content.js built after
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
