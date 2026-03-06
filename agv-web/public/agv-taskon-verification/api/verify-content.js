// api/verify-content.js

export default async function handler(req, res) {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ isValid: false, reason: "Missing link" });
    }

    // Fetch the submitted link (only public pages work)
    const response = await fetch(link);

    if (!response.ok) {
      return res.status(400).json({ isValid: false, reason: "Could not fetch content" });
    }

    const text = await response.text();

    // Normalize to lowercase for keyword checks
    const content = text.toLowerCase();

    // Required keywords
    const hasAGV = content.includes("agv");
    const hasTREE = content.includes("tree");
    const hasRWA = content.includes("rwa");
    const hasTag = content.includes("@agvprotocol");

    const isValid = hasAGV && hasTREE && hasRWA && hasTag;

    res.status(200).json({
      isValid,
      details: { hasAGV, hasTREE, hasRWA, hasTag }
    });
  } catch (err) {
    res.status(500).json({ isValid: false, error: err.message });
  }
}
