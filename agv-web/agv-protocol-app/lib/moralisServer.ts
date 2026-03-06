// lib/moralisServer.ts
import Moralis from "moralis";

let started: Promise<void> | null = null;

export async function ensureMoralisStarted() {
  if (!started) {
    started = Moralis.start({
      apiKey: process.env.MORALIS_API_KEY!,
    });
  }
  return started;
}
