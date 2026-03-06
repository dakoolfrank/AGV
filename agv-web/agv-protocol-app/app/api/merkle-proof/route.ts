// app/api/merkle-proof/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { readFileSync, writeFileSync, existsSync } from 'fs';

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAddress, getAddress, keccak256, AbiCoder } from "ethers";
import { adminDb } from "@/lib/firebase-admin";

/**
 * CONFIG
 * - PROOFS_JSON_PATH: absolute or relative path to your precomputed file (default: merkle.json).
 * - MERKLE_ROOT (optional): if set, the API validates the file's root matches this string.
 * - WL_CACHE_TTL_MS: cache the parsed JSON for N ms (default: 5m).
 */
const PROOFS_JSON_PATH = process.env.PROOFS_JSON_PATH || "merkle.json";
const MERKLE_ROOT_EXPECTED = process.env.MERKLE_ROOT || "0x49a63deb617700134f44436c90cdb063263653a450a86e62274d7d3ee3ebb43f";
const WL_CACHE_TTL_MS = Number(process.env.WL_CACHE_TTL_MS || 5 * 60 * 1000);

type ProofsFile = {
  merkleRoot: string;
  proofs: Record<string, string[]>;
};

let cache:
  | {
      at: number;
      root: string;
      proofsLc: Record<string, string[]>; // keys lowercased
    }
  | null = null;

async function resolvePath(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.isAbsolute(PROOFS_JSON_PATH)
      ? PROOFS_JSON_PATH
      : path.join(cwd, PROOFS_JSON_PATH),
    path.join(cwd, "merkle.json"),
    path.join(cwd, "public", "merkle.json"),
  ];
  for (const p of candidates) {
    try {
      const st = await fs.stat(p);
      if (st.isFile()) return p;
    } catch {}
  }
  throw new Error(
    `Proofs JSON not found. Looked for:\n` +
      candidates.map((c) => ` - ${c}`).join("\n")
  );
}

function normalizeProofs(pf: ProofsFile) {
  // Normalize keys to lowercase, ensure each proof element is 0x-prefixed hex
  const proofsLc: Record<string, string[]> = {};
  for (const [addr, arr] of Object.entries(pf.proofs || {})) {
    if (!addr) continue;
    const key = addr.toLowerCase();
    proofsLc[key] = (arr || []).map((x) =>
      x.startsWith("0x") ? x : `0x${x}`
    );
  }
  return {
    root: pf.merkleRoot,
    proofsLc,
  };
}

async function loadProofs() {
  const now = Date.now();
  if (cache && now - cache.at <= WL_CACHE_TTL_MS) return cache;

  const filePath = await resolvePath();
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: ProofsFile;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in proofs file.");
  }
  if (!parsed?.merkleRoot || typeof parsed.merkleRoot !== "string")
    throw new Error("Missing/invalid merkleRoot in proofs file.");
  if (!parsed?.proofs || typeof parsed.proofs !== "object")
    throw new Error("Missing/invalid proofs mapping in proofs file.");

  const { root, proofsLc } = normalizeProofs(parsed);

  if (
    MERKLE_ROOT_EXPECTED &&
    root.toLowerCase() !== MERKLE_ROOT_EXPECTED.toLowerCase()
  ) {
    throw new Error(
      `Configured MERKLE_ROOT does not match file's merkleRoot.
Expected: ${MERKLE_ROOT_EXPECTED}
     Got: ${root}`
    );
  }

  cache = { at: now, root, proofsLc };
  return cache;
}

// Check if wallet is whitelisted in Firebase
async function isWalletWhitelisted(address: string): Promise<boolean> {
  try {
    const snapshot = await adminDb.collection('whitelisted_wallets')
      .where('status', '==', 'active')
      .get();

    const lowerAddr = address.toLowerCase();

    const wallets = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.address?.toLowerCase() === lowerAddr ||
        data.walletAddress?.toLowerCase() === lowerAddr;
    });
    return wallets.length > 0;
  } catch (error) {
    console.error('Error checking whitelist:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const addrParam = (url.searchParams.get("address") || "").trim();

  // Basic validation
  if (!isAddress(addrParam)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // We accept any checksum, but look up by lowercase
  const addressLc = addrParam.toLowerCase();
  const checksum = getAddress(addrParam); // canonical checksum for display

  try {
    // First check if wallet is whitelisted in Firebase
    const isWhitelisted = await isWalletWhitelisted(addressLc);
    
    if (!isWhitelisted) {
      return NextResponse.json(
        { whitelisted: false, message: "Wallet not whitelisted" },
        { status: 404 }
      );
    }

    // If whitelisted, try to get merkle proof from file
    try {
      const { root, proofsLc } = await loadProofs();
      const proof = proofsLc[addressLc] || [];

      if (!proof.length) {
        // Wallet is whitelisted but no merkle proof available
        return NextResponse.json({
          whitelisted: true,
          address: checksum,
          root: null,
          leaf: null,
          proof: [],
          message: "Wallet is whitelisted but no merkle proof available"
        });
      }

      // Optional: include the leaf so clients can precheck on the front end
      const abiCoder = new AbiCoder();
      const leaf = keccak256(abiCoder.encode(["address"], [addressLc]));

      return NextResponse.json({
        whitelisted: true,
        address: checksum,
        root,
        leaf,
        proof,
      });
    } catch (proofError) {
      // If merkle proof fails but wallet is whitelisted, return whitelisted status
      console.warn('Merkle proof failed but wallet is whitelisted:', proofError);
      return NextResponse.json({
        whitelisted: true,
        address: checksum,
        root: null,
        leaf: null,
        proof: [],
        message: "Wallet is whitelisted but merkle proof unavailable"
      });
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
