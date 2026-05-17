/**
 * Derive the Solana keypair from the seed phrase in .env using the
 * standard Phantom/Solflare path (m/44'/501'/0'/0').
 *
 * Prints public address + balance. NEVER prints the private key.
 *
 * Run: bun run src/derive-wallet.ts
 */
import "./lib/env.ts";
import { mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const PHRASE = process.env.SOLANA_SEED_PHRASE;
const PATH = process.env.SOLANA_DERIVATION_PATH ?? "m/44'/501'/0'/0'";
const RPC = process.env.SOLANA_RPC_URL!;

if (!PHRASE) throw new Error("SOLANA_SEED_PHRASE missing");

const seed = mnemonicToSeedSync(PHRASE.trim());
const derived = derivePath(PATH, seed.toString("hex")).key;
const kp = Keypair.fromSeed(derived);

console.log("Public address:", kp.publicKey.toBase58());

const conn = new Connection(RPC, "confirmed");
const sol = await conn.getBalance(kp.publicKey);
console.log(`SOL balance: ${sol / 1e9} SOL`);

// USDC ATA balance
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
try {
  const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
  const ata = await getAssociatedTokenAddress(USDC_MINT, kp.publicKey);
  const acct = await getAccount(conn, ata);
  console.log(`USDC balance: ${Number(acct.amount) / 1e6} USDC`);
} catch (e: any) {
  console.log("USDC: no ATA yet or error:", e.message);
}
