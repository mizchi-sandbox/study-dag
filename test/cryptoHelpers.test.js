/* @flow */
import assert from 'assert'
import immer from 'immer'
import keypair from 'keypair'
import blake from 'blakejs'
import uuid from 'uuid'
import {
  encrypt,
  decrypt,
  sign,
  verify,
  signData,
  verifyData
} from '../src/cryptoHelpers'

// define
const pair: { public: string, private: string } = keypair()
const raw = JSON.stringify({
  from: 'alice',
  to: 'bob',
  amount: 1000
})

// encrypt/decrypt
const encrypted = encrypt(raw, pair.public)
const decrypted = decrypt(encrypted, pair.private)

assert(encrypted !== decrypted)
assert(raw === decrypted)

// verify
const hash = blake.blake2bHex(raw)
const signature = sign(hash, pair.private)
const verified = verify(hash, pair.public, signature)
assert(verified)

// -----------

type Wallet = {
  public: string,
  private: string,
  amount: number
}

type WalletMap = { [string]: Wallet }

type Hash = string
type Address = string

type Transaction = {
  from: Address,
  to: Address,
  amount: number,
  timestamp: number
}

type DAG = { [string]: Unit }

type Unit = {
  id: string,
  signature: string,
  transaction: Transaction,
  verifiedTo: Hash[]
}

const walletMap: WalletMap = {
  admin: {
    ...keypair(),
    amount: 0
  },
  alice: {
    ...keypair(),
    amount: 1000
  },
  bob: {
    ...keypair(),
    amount: 0
  }
}

const buildUnit = (unit: Unit) =>
  JSON.stringify({
    id: unit.id,
    verifiedTo: unit.verifiedTo,
    transaction: unit.transaction
  })

function signUnit(unit: Unit, privateKey: string): string {
  return signData(buildUnit(unit), privateKey)
}

function verifyUnit(unit: Unit, publicKey: string, signature: string): boolean {
  return verifyData(buildUnit(unit), publicKey, signature)
}

function createNewUnit(
  dag: DAG,
  transaction: Transaction,
  privateKey: string,
  verifyingTo: string[]
): {
  unit: Unit,
  dag: DAG
} {
  const id = uuid()
  const verifiedTo = verifyingTo.filter(verifyId => {
    if (verifyId === rootId) {
      // skip validate to rootId
      console.log('verify-root: ', id, '>', rootId)
      return true
    } else {
      // TODO: validate
      const u: Unit = dag[verifyId]
      const publicKey = walletMap[u.transaction.from].public
      const result = verifyUnit(u, publicKey, u.signature)
      if (result) {
        console.log('verify: ', id, '>', verifyId)
      } else {
        console.log('reject: ', id, '>', verifyId)
      }
      return result
    }
  })

  const signature = signData(
    JSON.stringify({ id, verifiedTo, transaction }),
    privateKey
  )

  const newUnit: Unit = {
    id,
    signature,
    transaction,
    verifiedTo
  }

  const newDag = { ...dag, [newUnit.id]: newUnit }
  console.log('create:', id)
  return { unit: newUnit, dag: newDag }
}

// run

const rootId = uuid()
const rootTransaction = {
  from: 'alice',
  to: 'bob',
  amount: 0,
  timestamp: Date.now() - 1000
}

const genesis: Unit = {
  id: rootId,
  signature: 'this-is-root',
  transaction: rootTransaction,
  verifiedTo: []
}

const dag0: DAG = {
  [rootId]: genesis
}

// create unit
const { unit: unit0, dag: dag1 } = createNewUnit(
  dag0,
  {
    from: 'alice',
    to: 'bob',
    amount: 10,
    timestamp: Date.now()
  },
  walletMap.alice.private,
  [rootId]
)

const { unit: unit1, dag: dag2 } = createNewUnit(
  dag1,
  {
    from: 'bob',
    to: 'alice',
    amount: 3,
    timestamp: Date.now() + 1000
  },
  walletMap.bob.private,
  [unit0.id]
)

const { unit: unit2, dag: dag3 } = createNewUnit(
  dag2,
  {
    from: 'bob',
    to: 'alice',
    amount: 2,
    timestamp: Date.now() + 2000
  },
  walletMap.bob.private,
  [unit0.id, unit1.id]
)

// console.log(dag2)
