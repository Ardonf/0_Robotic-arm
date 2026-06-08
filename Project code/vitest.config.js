import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mockDir = path.resolve(__dirname, 'tests/__mocks__/three')

export default defineConfig({
  test: {
    include: ['tests/**/*.test.*'],
  },
  resolve: {
    alias: {
      'three': mockDir,
    },
  },
})
