# Agent Initialization Script

## Quick Start

Run the script to initialize all Master & Sub-Agents:

```bash
npm run init-agents
```

Or directly with tsx:

```bash
npx tsx scripts/initialize-agents.ts
```

## What It Does

1. **Creates/Updates KOL Profiles** in `kol_profiles` collection
   - Generates unique KOL IDs (AGV-KOL######)
   - Generates 6-digit refCodes
   - Sets agentType and agentLevel
   - Links Sub-Agents to Masters

2. **Creates Agent Allocations** in `agent_allocations` collection
   - Master Agents: 100,000 preGVT + 1,000 sGVT
   - Sub-Agents: 10,000 preGVT + 1,000 sGVT

3. **Handles Existing Records**
   - Updates existing KOL profiles if wallet matches
   - Updates existing allocations if found
   - Prevents duplicates

## Prerequisites

- Firebase Admin credentials configured in `.env`
- Required environment variables:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

## Output

The script will display:
- ✅ Successfully processed agents with KOL IDs and refCodes
- ❌ Any errors encountered
- 📊 Summary statistics

## Example Output

```
🚀 Initializing agents...

📋 Processing Master Agents (Level-1)...

  Processing: Ling Feng (0xf6236d51d602fbebaf9b7da8b6d23e4e72b010ffc)
    ✅ Created new allocation
    KOL ID: AGV-KOL123456
    Ref Code: 123456
    Status: Created

📋 Processing Sub-Agents (Level-2)...

  Processing: Li Danling (0x524fcd94927c29fe5e2ff3c4363b2be3c0fe3414)
    ✅ Created new allocation
    KOL ID: AGV-KOL789012
    Ref Code: 789012
    Master: Ling Feng (AGV-KOL123456)
    Status: Created

============================================================
📊 SUMMARY
============================================================
Total Agents: 11
Successful: 11
Errors: 0
Created: 11
Updated: 0
```

## Troubleshooting

**Error: Missing Firebase credentials**
- Check `.env` file has all required Firebase Admin variables

**Error: Permission denied**
- Ensure Firebase Admin SDK has write access to Firestore

**Agents not appearing**
- Check Firestore console for created records
- Verify wallet addresses are correct
- Check for duplicate wallet addresses

