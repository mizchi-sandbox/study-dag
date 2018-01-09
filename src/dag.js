/* @flow */

// Implement SPECTRE on DAG
// WIP: Not tested and not runnable yet

import uuid from 'uuid'
import sortBy from 'lodash.sortby'
import SHA256 from 'crypto-js/sha256'
import immer from 'immer'

type Hash = string
type Address = string

type Transfering = {
  from: Address,
  to: Address,
  amount: number,
  timestamp: number
}

type Unit = {
  hash: Hash,
  data: Transfering,
  verifiedBy: Hash[],
  verifiedTo: Hash[]
}

type DAG = { [Hash]: Unit }
type Wallet = { [Hash]: number }
type UserId = string

function calculateHash(verifyingHashes: Hash[], data: Transfering): Hash {
  const hash = verifyingHashes.join(':')
  return SHA256(
    `${hash}-${data.from}-${data.to}-${data.amount}-${data.timestamp}`
  )
}

const values: <T>({ [string]: T }) => T[] = (Object.values: any)

function canTransferFromAddress(
  dag: DAG,
  address: Address,
  transfering: Transfering
): boolean {
  const transactions = values(dag).filter(
    unit =>
      (unit.data.from === address || unit.data.to === address) &&
      unit.data.timestamp < transfering.timestamp
  )
  const sortedTransactions = sortBy(transactions, h => h.data.timestamp)

  const lastBalance = sortedTransactions.reduce(
    (acc, unit) => {
      if (!acc.verified) {
        return acc
      }

      let nextAmount =
        unit.data.from === address
          ? transfering.amount - unit.data.amount
          : transfering.amount + unit.data.amount

      if (nextAmount < 0) {
        return { verified: false }
      }

      return { verified: true, amount: nextAmount }
    },
    { verified: true, amount: 0 }
  )

  if (!lastBalance.verified) {
    return false
  } else if (lastBalance.amount >= transfering.amount) {
    return true
  } else {
    return false
  }
}

function calculateWeightOnUnit(dag: DAG, unit: Unit): number {
  const unitsVerifiedMe = values(dag).filter(u =>
    u.verifiedTo.includes(unit.hash)
  )

  return unitsVerifiedMe.reduce((acc, u) => {
    return acc + calculateWeightOnUnit(dag, u)
  }, 0)
}

const VERIFY_THRESHOLD = 5

function findUnitsToNeedVerify(dag: DAG): Unit[] {
  const unverifiedUnits = values(dag).filter(
    unit => calculateWeightOnUnit(dag, unit) < VERIFY_THRESHOLD
  )

  return unverifiedUnits
}

function validate(dag: DAG, transfering: Transfering): boolean {
  return canTransferFromAddress(dag, transfering.from, transfering)
}

function createNewUnit(dag: DAG, data: Transfering): false | Unit {
  const unitsToNeedVerify = findUnitsToNeedVerify(dag)
  const isValid = unitsToNeedVerify.every(unit => {
    return validate(dag, unit.data)
  })

  if (!isValid) {
    return false
  }

  const verifiedTo = unitsToNeedVerify.map(u => u.hash)

  return {
    hash: calculateHash(verifiedTo, data),
    data,
    verifiedUnits: unitsToNeedVerify,
    verifiedBy: [],
    verifiedTo
  }
}

function addNewUnit(dag: DAG, data: Transfering): DAG {
  const unit = createNewUnit(dag, data)
  if (unit) {
    return immer(dag, draft => {
      draft[unit.hash] = unit
      unit.verifiedTo.forEach(hash => {
        draft[hash].verifiedBy.push(hash)
      })
    })
  } else {
    console.log('addUnit: failed')
    return dag
  }
}

// run

const wallet: Wallet = {
  alice: 10000,
  bob: 0
}

const dag: DAG = {}

const next = addNewUnit(dag, {
  from: 'alice',
  to: 'bob',
  amount: 100,
  timestamp: Date.now()
})
