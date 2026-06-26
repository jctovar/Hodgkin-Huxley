import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` solo aplica al build de producción, para servir desde la subruta de
// GitHub Pages (https://jctovar.github.io/Hodgkin-Huxley/). Dev y tests siguen en '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Hodgkin-Huxley/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/sim/**', 'src/components/**', 'src/hooks/**', 'src/lib/**'],
    },
  },
}))

