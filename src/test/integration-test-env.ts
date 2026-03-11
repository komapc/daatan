import { beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, truncateDatabase, teardownTestDatabase } from './integration-helper'

// This will run once before all integration tests
beforeAll(async () => {
  await setupTestDatabase()
}, 120000) // Give plenty of time for docker and migrations

// This will run before each test file
beforeEach(async () => {
  await truncateDatabase()
})

// This will run once after all integration tests
afterAll(async () => {
  await teardownTestDatabase()
})
