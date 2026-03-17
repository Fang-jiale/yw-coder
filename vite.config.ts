import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  root: '.',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    // 启用代码分割
    rollupOptions: {
      output: {
        // 手动分包策略
        manualChunks: {
          // React 生态
          'react-vendor': ['react', 'react-dom', 'zustand'],
          // Monaco Editor
          'monaco-vendor': ['monaco-editor', '@monaco-editor/react'],
          // Radix UI
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-context-menu',
          ],
          // 其他工具库
          'utils-vendor': [
            'tailwind-merge',
            'clsx',
            'date-fns',
            'lucide-react',
            'immer',
            'uuid',
          ],
        },
      },
    },
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // 生成 sourcemap（生产环境可关闭）
    sourcemap: false,
    // 启用分块分析（开发时可查看）
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
    // 优化模块解析
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'monaco-editor',
      '@monaco-editor/react',
      'immer',
      'clsx',
      'tailwind-merge',
      'lucide-react',
      'date-fns',
    ],
  },
  server: {
    port: 5173,
    // 优化开发服务器
    hmr: {
      overlay: true,
    },
  },
  // 缓存配置
  cacheDir: 'node_modules/.vite',
  // 调整 esbuild 选项
  esbuild: {
    // 生产环境移除 console.log
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})
