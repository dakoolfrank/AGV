import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;       // Notion integration token
const NOTION_DB_ID = process.env.NOTION_DB_ID;       // Database ID
const WALLET_PROPERTY = "Wallet";                    // Property name in Notion database

const notion = new Client({ auth: NOTION_TOKEN });

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address) {
    return res.status(200).json({ result: { isValid: false } });
  }

  try {
    // Query Notion DB for the wallet
    const response = await notion.databases.query({
      database_id: NOTION_DB_ID,
      filter: {
        property: WALLET_PROPERTY,
        rich_text: {
          equals: address.toLowerCase()
        }
      }
    });

    const isWhitelisted = response.results.length > 0;

    return res.status(200).json({ result: { isValid: isWhitelisted } });

  } catch (err) {
    console.error("Error verifying wallet:", err.message);
    return res.status(200).json({ result: { isValid: false } });
  }
}
