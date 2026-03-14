// api/verify-share-nft.js

export default async function handler(req, res) {
  try {
    const { tweetUrl } = req.body || {};

    if (!tweetUrl) {
      return res.status(400).json({ isValid: false, reason: "Missing tweetUrl" });
    }

    // Extract tweet ID from URL
    const match = tweetUrl.match(/status\/(\d+)/);
    if (!match) {
      return res.status(400).json({ isValid: false, reason: "Invalid tweet URL" });
    }
    const tweetId = match[1];

    // Fetch tweet details from Twitter API
    const resp = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=entities,attachments,text`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    const tweet = await resp.json();
    if (!tweet?.data) {
      return res.status(400).json({ isValid: false, reason: "Tweet not found" });
    }

    const text = tweet.data.text.toLowerCase();

    const hasHashtags =
      text.includes("#agv") && text.includes("#tree") && text.includes("#rwa");
    const hasMention = text.includes("@agvprotocol");
    const hasMedia = tweet.data.attachments?.media_keys?.length > 0;

    const valid = hasHashtags && hasMention && hasMedia;

    return res.status(200).json({ isValid: valid });
  } catch (err) {
    return res.status(500).json({ isValid: false, error: err.message });
  }
}
