import { NextRequest, NextResponse } from "next/server";

const PASS_CONFIG: Record<
  string,
  { name: string; description: string; image: string; price: string }
> = {
  seedpass: {
    name: "Seed Pass",
    description:
      "AGV Protocol Seed Pass — Entry-level membership granting access to the AGV ecosystem. Includes basic AI agent quota and community access.",
    image: "/seedpass.jpg",
    price: "29 USDT",
  },
  treepass: {
    name: "Tree Pass",
    description:
      "AGV Protocol Tree Pass — Growth-tier membership with expanded AI agent quota, priority support, and enhanced staking rewards.",
    image: "/treepass.jpg",
    price: "59 USDT",
  },
  solarpass: {
    name: "Solar Pass",
    description:
      "AGV Protocol Solar Pass — Premium membership unlocking advanced AI agents, dedicated compute resources, and governance voting rights.",
    image: "/solarpass.jpg",
    price: "299 USDT",
  },
  computepass: {
    name: "Compute Pass",
    description:
      "AGV Protocol Compute Pass — Elite membership providing maximum AI compute allocation, institutional-grade features, and top-tier agent licensing.",
    image: "/computepass.jpg",
    price: "899 USDT",
  },
};

const PASS_TIERS: Record<string, string> = {
  seedpass: "Seed",
  treepass: "Tree",
  solarpass: "Solar",
  computepass: "Compute",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pass: string; id: string }> }
) {
  const { pass, id } = await params;
  const passKey = pass.toLowerCase();
  const config = PASS_CONFIG[passKey];

  if (!config) {
    return NextResponse.json({ error: "Unknown pass type" }, { status: 404 });
  }

  const tokenId = parseInt(id, 10);
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
  }

  // Build absolute image URL from request origin
  const origin =
    _req.headers.get("x-forwarded-host") ?? _req.headers.get("host") ?? "";
  const protocol = _req.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = origin ? `${protocol}://${origin}` : "https://agvnexrur.ai";
  const imageUrl = `${baseUrl}${config.image}`;

  const metadata = {
    name: `${config.name} #${tokenId}`,
    description: config.description,
    image: imageUrl,
    external_url: "https://agvnexrur.ai",
    attributes: [
      { trait_type: "Tier", value: PASS_TIERS[passKey] },
      { trait_type: "Price", value: config.price },
      { trait_type: "Network", value: "BNB Smart Chain" },
      { trait_type: "Standard", value: "ERC-721A" },
      { trait_type: "Type", value: "Collectible" },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
