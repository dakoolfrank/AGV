// app/api/wallet-nfts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Normalize IPFS and common gateway URLs to a stable gateway */
function toGateway(u?: string | null) {
  if (!u) return undefined;
  if (u.startsWith("ipfs://")) return u.replace(/^ipfs:\/\//, "https://ipfscdn.io/ipfs/");
  return u.replace(/^https?:\/\/ipfs\.io\/ipfs\//i, "https://ipfscdn.io/ipfs/");
}

/** Moralis REST accepts hex chain IDs (e.g. 0x38) or names (e.g. bsc, polygon). */
function normalizeChainParam(raw: string) {
  if (!raw) throw new Error("Missing chain");
  if (/^0x[0-9a-f]+$/i.test(raw)) return raw; // already hex
  if (/^\d+$/.test(raw)) return "0x" + Number(raw).toString(16); // decimal -> hex
  return raw; // pass-through names like "bsc", "polygon", "arbitrum"
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.MORALIS_API_KEY) {
      return NextResponse.json({ error: "MORALIS_API_KEY not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || "").trim();
    const chainRaw = (searchParams.get("chain") || "").trim();
    const cursor = (searchParams.get("cursor") || "").trim(); // optional pass-through

    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    if (!chainRaw) return NextResponse.json({ error: "Missing chain" }, { status: 400 });

    const chain = normalizeChainParam(chainRaw);

    // Moralis v2.2 wallet NFTs endpoint
    const base = "https://deep-index.moralis.io/api/v2.2";
    const url = new URL(`${base}/${address}/nft`);
    url.searchParams.set("chain", chain);
    url.searchParams.set("format", "decimal"); // token_id as decimal string
    url.searchParams.set("normalizeMetadata", "true");
    if (cursor) url.searchParams.set("cursor", cursor); // support pagination if you need it

    const res = await fetchWithRetry(
      url.toString(),
      {
        headers: {
          "X-API-Key": process.env.MORALIS_API_KEY!,
          accept: "application/json",
        },
        cache: "no-store",
      },
      4 // tries (exponential backoff inside helper)
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Surface upstream errors to the client as 502 (bad gateway)
      return NextResponse.json({ error: body || `Upstream ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const items = (data?.result ?? []).map((it: any) => {
      const img =
        it?.normalized_metadata?.image ??
        it?.metadata?.image ??
        it?.media?.media_collection?.high?.url ??
        it?.media?.original_media_url ??
        it?.media?.media_collection?.low?.url ??
        null;

      return {
        tokenAddress: (it?.token_address || "").toLowerCase(),
        tokenIdStr: String(it?.token_id ?? ""),
        contractType: it?.contract_type || "ERC721",
        name: it?.normalized_metadata?.name ?? it?.name ?? null,
        imageUrl: toGateway(img),
      };
    });

    // If your client wants to paginate, you can also return data.cursor / data.page, etc.
    return NextResponse.json({ items, cursor: data?.cursor ?? null });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    // Include a short tag to help identify DNS/network failures quickly in logs
    return NextResponse.json({ error: `[wallet-nfts] ${msg}` }, { status: 500 });
  }
}
