/**
 * Wallet layer.
 *
 * v0: BIP39 seed phrase from .env (Phantom-compatible derivation).
 *     Disposable wallet, $50 max, burn after hackathon.
 * v1: Swig integration (programmable wallet with session-based caps).
 *     Loaded at the same interface so the rest of the code doesn't care.
 */

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import bs58 from "bs58";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

let cached: Keypair | null = null;
function hotKeypair(): Keypair {
  if (cached) return cached;

  // Prefer seed phrase (BIP39). Fall back to bs58 secret key for back-compat.
  const phrase = process.env.SOLANA_SEED_PHRASE;
  const path = process.env.SOLANA_DERIVATION_PATH ?? "m/44'/501'/0'/0'";
  if (phrase) {
    const seed = mnemonicToSeedSync(phrase.trim());
    const derived = derivePath(path, seed.toString("hex")).key;
    cached = Keypair.fromSeed(derived);
    return cached;
  }

  const sk = process.env.SOLANA_WALLET_PRIVATE_KEY;
  if (!sk) throw new Error("Neither SOLANA_SEED_PHRASE nor SOLANA_WALLET_PRIVATE_KEY set in .env");
  cached = Keypair.fromSecretKey(bs58.decode(sk));
  return cached;
}

export function pubkey(): string {
  return hotKeypair().publicKey.toBase58();
}

/**
 * Sign and broadcast a base64 VersionedTransaction returned by Jupiter.
 * Returns the tx signature.
 */
export async function signAndSend(base64Tx: string): Promise<string> {
  const buf = Buffer.from(base64Tx, "base64");
  const tx = VersionedTransaction.deserialize(buf);
  tx.sign([hotKeypair()]);
  const sig = await connection.sendTransaction(tx, { maxRetries: 3 });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export { connection };
