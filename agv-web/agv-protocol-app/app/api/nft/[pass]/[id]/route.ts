import { NextRequest, NextResponse } from "next/server";

interface PassInfo {
  name: string;
  description: string;
  image: string;
  price: string;
  tier: string;
  type: "Collectible" | "Agent License";
}

const PASS_CONFIG: Record<string, PassInfo> = {
  // ── Collectible (普通通行证) ──
  seedpass: {
    name: "Seed Pass",
    description:
      "AGV Protocol Seed Pass — Entry-level membership granting access to the AGV ecosystem. Includes basic AI agent quota and community access.",
    image: "/seedpass.jpg",
    price: "29 USDT",
    tier: "Seed",
    type: "Collectible",
  },
  treepass: {
    name: "Tree Pass",
    description:
      "AGV Protocol Tree Pass — Growth-tier membership with expanded AI agent quota, priority support, and enhanced staking rewards.",
    image: "/treepass.jpg",
    price: "59 USDT",
    tier: "Tree",
    type: "Collectible",
  },
  solarpass: {
    name: "Solar Pass",
    description:
      "AGV Protocol Solar Pass — Premium membership unlocking advanced AI agents, dedicated compute resources, and governance voting rights.",
    image: "/solarpass.jpg",
    price: "299 USDT",
    tier: "Solar",
    type: "Collectible",
  },
  computepass: {
    name: "Compute Pass",
    description:
      "AGV Protocol Compute Pass — Elite membership providing maximum AI compute allocation, institutional-grade features, and top-tier agent licensing.",
    image: "/computepass.jpg",
    price: "899 USDT",
    tier: "Compute",
    type: "Collectible",
  },
  // ── Agent License (代理授权证书，Soulbound) ──
  seedagent: {
    name: "Seed Agent License",
    description:
      "AGV Protocol Seed Agent License — Soulbound authorization granting an agent the right to distribute Seed Pass NFTs on behalf of AGV Protocol.",
    image: "/seedagent.png",
    price: "N/A",
    tier: "Seed",
    type: "Agent License",
  },
  treeagent: {
    name: "Tree Agent License",
    description:
      "AGV Protocol Tree Agent License — Soulbound authorization granting an agent the right to distribute Tree Pass NFTs on behalf of AGV Protocol.",
    image: "/treeagent.png",
    price: "N/A",
    tier: "Tree",
    type: "Agent License",
  },
  solaragent: {
    name: "Solar Agent License",
    description:
      "AGV Protocol Solar Agent License — Soulbound authorization granting an agent the right to distribute Solar Pass NFTs on behalf of AGV Protocol.",
    image: "/solaragent.png",
    price: "N/A",
    tier: "Solar",
    type: "Agent License",
  },
  computeagent: {
    name: "Compute Agent License",
    description:
      "AGV Protocol Compute Agent License — Soulbound authorization granting an agent the right to distribute Compute Pass NFTs on behalf of AGV Protocol.",
    image: "/computeagent.png",
    price: "N/A",
    tier: "Compute",
    type: "Agent License",
  },
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

  const attributes = [
    { trait_type: "Tier", value: config.tier },
    { trait_type: "Type", value: config.type },
    { trait_type: "Network", value: "BNB Smart Chain" },
    { trait_type: "Standard", value: "ERC-721A" },
  ];
  if (config.type === "Collectible") {
    attributes.push({ trait_type: "Price", value: config.price });
  } else {
    attributes.push({ trait_type: "Transferable", value: "No (Soulbound)" });
  }

  const metadata = {
    name: `${config.name} #${tokenId}`,
    description: config.description,
    image: imageUrl,
    external_url: "https://agvnexrur.ai",
    attributes,
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
