/**
 * Load .env with override. Required because Bun (and many shells) preload
 * env vars and won't be overridden by default — including empty shell vars
 * like ANTHROPIC_API_KEY="" which would shadow the real key from .env.
 *
 * Every entry-point script must import this BEFORE any code that reads
 * process.env.
 */
import { config } from "dotenv";

config({ override: true });
