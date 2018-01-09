/* @flow */
import crypto from 'crypto'
import blake from 'blakejs'

const { publicEncrypt, privateDecrypt } = (crypto: any)

export const encrypt = (raw: string, publicKey: string) => {
  const encrypted = publicEncrypt(publicKey, new Buffer(raw))
  return encrypted.toString('base64')
}

export const decrypt = (encrypted: string, privateKey: string): string => {
  const decrypted = privateDecrypt(privateKey, new Buffer(encrypted, 'base64'))
  return decrypted.toString('utf8')
}

export const sign = (hash: string, privateKey: string): string => {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(new Buffer(hash))
  return sign.sign(privateKey, 'base64')
}

export const signData = (raw: string, privateKey: string): string => {
  const hash = blake.blake2bHex(raw)
  return sign(hash, privateKey)
}

export const verify = (
  hash: string,
  publicKey: string,
  signature: string
): boolean => {
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(new Buffer(hash))
  return verifier.verify(publicKey, signature, 'base64')
}

export const verifyData = (raw: string, publicKey: string, signature: string): boolean => {
  const hash = blake.blake2bHex(raw)
  return verify(hash, publicKey, signature)
}
