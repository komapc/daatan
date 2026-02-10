import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Mock state to simulate database state for property testing
type User = {
    cuAvailable: number
    cuLocked: number
}

type Commitment = {
    id: string
    cuCommitted: number
}

type SystemState = {
    user: User
    commitments: Commitment[]
    ledger: { type: string, amount: number }[]
}

// Pure functions simulating the business logic to verify invariants
const createCommitment = (state: SystemState, amount: number): SystemState => {
    if (amount > state.user.cuAvailable) throw new Error('Insufficient CU')

    return {
        user: {
            cuAvailable: state.user.cuAvailable - amount,
            cuLocked: state.user.cuLocked + amount
        },
        commitments: [...state.commitments, { id: 'new', cuCommitted: amount }],
        ledger: [...state.ledger, { type: 'COMMITMENT_LOCK', amount: -amount }]
    }
}

const updateCommitment = (state: SystemState, commitmentIndex: number, newAmount: number): SystemState => {
    const commitment = state.commitments[commitmentIndex]
    if (!commitment) throw new Error('Commitment not found')

    const delta = newAmount - commitment.cuCommitted

    if (delta > 0 && delta > state.user.cuAvailable) throw new Error('Insufficient CU for increase')

    const newCommitments = [...state.commitments]
    newCommitments[commitmentIndex] = { ...commitment, cuCommitted: newAmount }

    const ledgerEntry = delta > 0
        ? { type: 'COMMITMENT_LOCK', amount: -delta }
        : { type: 'REFUND', amount: -delta } // refund is positive amount in ledger usually, but here delta is negative so -delta is positive

    return {
        user: {
            cuAvailable: state.user.cuAvailable - delta,
            cuLocked: state.user.cuLocked + delta
        },
        commitments: newCommitments,
        ledger: [...state.ledger, ledgerEntry]
    }
}

const removeCommitment = (state: SystemState, commitmentIndex: number): SystemState => {
    const commitment = state.commitments[commitmentIndex]
    if (!commitment) throw new Error('Commitment not found')

    const newCommitments = state.commitments.filter((_, i) => i !== commitmentIndex)

    return {
        user: {
            cuAvailable: state.user.cuAvailable + commitment.cuCommitted,
            cuLocked: state.user.cuLocked - commitment.cuCommitted
        },
        commitments: newCommitments,
        ledger: [...state.ledger, { type: 'REFUND', amount: commitment.cuCommitted }]
    }
}

describe('Commitment System Properties', () => {

    it('should conserve total CU across creation', () => {
        // Property: available + locked + committed = constant (before vs after)
        // Actually: available + locked should be constant if we consider locked as part of user's assets
        // Or: user.cuAvailable + user.cuLocked should be CONSTANT (if no fees)

        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 10000 }), // Initial available
                fc.integer({ min: 0, max: 5000 }),    // Initial locked
                fc.integer({ min: 1, max: 1000 }),    // Commit amount
                (initialAvailable, initialLocked, amount) => {
                    const state = {
                        user: { cuAvailable: initialAvailable, cuLocked: initialLocked },
                        commitments: [],
                        ledger: []
                    }

                    if (amount <= initialAvailable) {
                        const newState = createCommitment(state, amount)

                        // Invariant: Total CU held by user (available + locked) remains same
                        expect(newState.user.cuAvailable + newState.user.cuLocked)
                            .toBe(state.user.cuAvailable + state.user.cuLocked)

                        // Invariant: Valid ledger entry
                        expect(newState.ledger).toHaveLength(1)
                        expect(newState.ledger[0].amount).toBe(-amount)
                    }
                }
            )
        )
    })

    it('should conserve total CU across updates', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 10000 }),
                fc.integer({ min: 100, max: 5000 }),
                fc.integer({ min: 1, max: 100 }), // Old amount
                fc.integer({ min: 1, max: 100 }), // New amount
                (initialAvailable, initialLocked, oldAmount, newAmount) => {
                    const state = {
                        user: { cuAvailable: initialAvailable, cuLocked: initialLocked },
                        commitments: [{ id: '1', cuCommitted: oldAmount }],
                        ledger: []
                    }

                    const delta = newAmount - oldAmount

                    if (delta <= initialAvailable) { // simplified check (if increasing)
                        const newState = updateCommitment(state, 0, newAmount)

                        // Invariant: Total CU same
                        expect(newState.user.cuAvailable + newState.user.cuLocked)
                            .toBe(state.user.cuAvailable + state.user.cuLocked)

                        // Invariant: New commitment amount correct
                        expect(newState.commitments[0].cuCommitted).toBe(newAmount)
                    }
                }
            )
        )
    })

    it('should conserve total CU across removal', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 10000 }),
                fc.integer({ min: 100, max: 5000 }),
                fc.integer({ min: 1, max: 100 }), // Committed amount
                (initialAvailable, initialLocked, amount) => {
                    const state = {
                        user: { cuAvailable: initialAvailable, cuLocked: initialLocked },
                        commitments: [{ id: '1', cuCommitted: amount }],
                        ledger: []
                    }

                    const newState = removeCommitment(state, 0)

                    // Invariant: Total CU same
                    expect(newState.user.cuAvailable + newState.user.cuLocked)
                        .toBe(state.user.cuAvailable + state.user.cuLocked)

                    // Invariant: cuAvailable increased by amount
                    expect(newState.user.cuAvailable).toBe(state.user.cuAvailable + amount)
                }
            )
        )
    })
})
