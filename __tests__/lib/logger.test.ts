import { describe, it, expect, vi } from 'vitest'

describe('Logger utilities', () => {
  describe('Server logger', () => {
    it('exports createLogger function', async () => {
      const { createLogger } = await import('@/lib/logger')

      expect(typeof createLogger).toBe('function')
    })

    it('creates a named logger instance', async () => {
      const { createLogger } = await import('@/lib/logger')
      const log = createLogger('test-module')

      expect(log).toBeDefined()
      expect(typeof log.info).toBe('function')
      expect(typeof log.error).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.debug).toBe('function')
    })

    it('exports a default logger instance', async () => {
      const { logger } = await import('@/lib/logger')

      expect(logger).toBeDefined()
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
    })
  })

  describe('Client logger', () => {
    it('exports createClientLogger function', async () => {
      const { createClientLogger } = await import('@/lib/client-logger')

      expect(typeof createClientLogger).toBe('function')
    })

    it('creates a named client logger with standard methods', async () => {
      const { createClientLogger } = await import('@/lib/client-logger')
      const log = createClientLogger('TestComponent')

      expect(log).toBeDefined()
      expect(typeof log.info).toBe('function')
      expect(typeof log.error).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.debug).toBe('function')
    })

    it('calls console methods when invoked', async () => {
      const { createClientLogger } = await import('@/lib/client-logger')
      const log = createClientLogger('TestComponent')

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      log.error({ detail: 'test' }, 'Something went wrong')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
