import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { ContributorApplication, KOLProfile } from '@/lib/types';
import { randomUUID } from 'crypto';

// Tier calculation function
const calculateTier = (channels: ContributorApplication['channels']): ContributorApplication['tier'] => {
  if (!channels || channels.length === 0) {
    return 'airdrop_hunter';
  }
  
  const maxFollowers = Math.max(...channels.map(channel => channel.followers));
  
  if (maxFollowers >= 100000) {
    return 'fund_partner';
  } else if (maxFollowers >= 10000) {
    return 'micro_kol';
  } else if (maxFollowers >= 1000) {
    return 'contributor';
  } else {
    return 'airdrop_hunter';
  }
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const applicationData = JSON.parse(formData.get('applicationData') as string);
    const files = formData.getAll('files') as File[];
    
    console.log("Parsed applicationData:", JSON.stringify(applicationData, null, 2));
    
    // Validate required fields
    if (!applicationData.identity?.displayName || 
        !applicationData.identity?.email) {
      return NextResponse.json(
        { error: 'Missing required personal information fields (displayName or email)' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingApplication = await adminDb.collection('contributor_applications')
      .where('identity.email', '==', applicationData.identity.email)
      .limit(1)
      .get();
    
    if (!existingApplication.empty) {
      return NextResponse.json(
        { error: 'An application with this email already exists' },
        { status: 409 }
      );
    }

    // Validate wallet addresses
    if (!applicationData.wallets || applicationData.wallets.length === 0) {
      return NextResponse.json(
        { error: 'At least one wallet address is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    const invalidWallets = applicationData.wallets.filter((wallet: { chain: string; address: string }) => 
      !wallet.chain || !wallet.address || 
      wallet.chain.trim() === '' || wallet.address.trim() === ''
    );
    
    if (invalidWallets.length > 0) {
      return NextResponse.json(
        { error: 'All wallet addresses must have both chain and address filled' },
        { status: 400 }
      );
    }

    if (!applicationData.channels || applicationData.channels.length === 0) {
      return NextResponse.json(
        { error: 'At least one social media channel is required' },
        { status: 400 }
      );
    }

    // Calculate tier based on highest follower count
    const tier = calculateTier(applicationData.channels);
    
    // Check for KOL referral code
    const kolReferralCode = applicationData.kolReferralCode;
    const isPrimaryKOL = !kolReferralCode;
    
    // Check if KOL already exists in agv-protocol-app by email
    let existingKol = null;
    try {
      // First try the 'kols' collection
      let kolQuery = await adminDb.collection('kols')
        .where('email', '==', applicationData.identity.email)
        .limit(1)
        .get();
      
      if (kolQuery.empty) {
        // Try the 'kol_profiles' collection as fallback
        kolQuery = await adminDb.collection('kol_profiles')
          .where('email', '==', applicationData.identity.email)
          .limit(1)
          .get();
      }
      
      if (!kolQuery.empty) {
        const doc = kolQuery.docs[0];
        const data = doc.data();
        existingKol = {
          id: doc.id,
          ...data
        } as {
          id: string;
          kolId: string;
          name: string;
          email: string;
          walletAddress: string;
        };
      }
    } catch (error) {
      console.log('Error looking for existing KOL:', error);
    }

    // Use existing KOL ID or generate new one
    const kolId = existingKol?.kolId || randomUUID();
    let refCode: string;
    
    if (existingKol?.kolId) {
      refCode = existingKol.kolId.replace('AGV-KOL', '');
    } else {
      // Generate new refCode for new KOL
      refCode = generateReferralCode();
    }
    
    // Create application first to get ID
    const applicationDoc = {
      ...applicationData,
      tier,
      kolId,
      isPrimaryKOL,
      attachments: {}, // Will be populated after file upload
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'new'
    };

    // Only include kolReferralCode if it's not undefined
    if (kolReferralCode !== undefined) {
      applicationDoc.kolReferralCode = kolReferralCode;
    }

    const docRef = await adminDb.collection('contributor_applications').add(applicationDoc);

    // Upload files if any
    let uploadedFiles: Array<{
      name: string;
      url: string;
      size: number;
      type: string;
      uploadedAt: string;
    }> = [];
    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        // Validate file size (20MB limit)
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 20MB.`);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `contributor_applications/${docRef.id}/${fileName}`;

        // Upload to Firebase Storage using Admin SDK
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ;
        const bucket = adminStorage.bucket(bucketName);
        
        const fileBuffer = await file.arrayBuffer();
        const fileUpload = bucket.file(filePath);
        
        await fileUpload.save(Buffer.from(fileBuffer), {
          metadata: {
            contentType: file.type,
            metadata: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        // Make file publicly accessible
        await fileUpload.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        return {
          name: file.name,
          url: publicUrl,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };
      });

      uploadedFiles = await Promise.all(uploadPromises);

      // Update application with file URLs
      await docRef.update({
        attachments: {
          portfolioFiles: uploadedFiles,
        },
        updatedAt: new Date(),
      });
    }

    // Create or update KOL profile in agv-protocol-app database
    await createKOLInProtocolApp({
      kolId,
      applicationData,
      tier,
      isPrimaryKOL,
      kolReferralCode,
      refCode,
      existingKol
    });

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      kolId,
      uploadedFiles: uploadedFiles.length,
      referralLinks: {
        userMints: `https://agvprotocol.org/mint/${refCode}`,
        kolRecruitment: `https://g3fund.org/contributor-application?ref=${refCode}`
      }
    });

  } catch (error) {
    console.error('Error creating contributor application:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create application' },
      { status: 500 }
    );
  }
}

// Helper function to generate unified referral code
function generateReferralCode(): string {
  // Generate a 6-digit number for consistency with agv-protocol-app
  const sixDigitNumber = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `${sixDigitNumber}`;
}

// Helper function to create KOL in agv-protocol-app
async function createKOLInProtocolApp({
  kolId,
  applicationData,
  tier,
  isPrimaryKOL,
  kolReferralCode,
  refCode,
  existingKol
}: {
  kolId: string;
  applicationData: ContributorApplication;
  tier: string;
  isPrimaryKOL: boolean;
  kolReferralCode?: string;
  refCode: string;
  existingKol?: {
    id: string;
    kolId: string;
    name: string;
    email: string;
    walletAddress: string;
  } | null;
}) {
  try {
    // Map tier to agv-protocol-app format
    const protocolTier = mapTierToProtocol(tier);
    
    // Get sponsor KOL if this is a secondary KOL
    let sponsorKolId = null;
    if (!isPrimaryKOL && kolReferralCode) {
      const sponsorQuery = await adminDb.collection('kol_profiles')
        .where('refCode', '==', kolReferralCode)
        .limit(1)
        .get();
      
      if (!sponsorQuery.empty) {
        sponsorKolId = sponsorQuery.docs[0].id;
      }
    }

    // Create KOL profile in g3_funding database
    const kolProfile: KOLProfile = {
      id: kolId,
      tier: protocolTier,
      status: 'pending',
      refCode: refCode,
      displayName: applicationData.identity.displayName,
      email: applicationData.identity.email,
      wallet: applicationData.wallets[0]?.address || '',
      region: [applicationData.identity.countryRegion],
      languages: applicationData.identity.languages,
      socials: applicationData.channels.map((channel) => ({
        platform: channel.platform,
        url: channel.url,
        username: extractUsernameFromUrl(channel.url, channel.platform),
        followers: channel.followers,
        verified: false
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      campaign: 'G3'
    };

    // Only include sponsorRef if kolReferralCode is not undefined
    if (kolReferralCode !== undefined) {
      kolProfile.sponsorRef = kolReferralCode;
    }

    // Save to Firestore
    await adminDb.collection('kol_profiles').doc(kolId).set({
      ...kolProfile,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // If there's a sponsor, create recruitment record
    if (sponsorKolId && kolReferralCode !== undefined) {
        const recruitment = {
          id: randomUUID(),
        sponsorKolId,
        childKolId: kolId,
        sponsorRef: kolReferralCode,
        childRef: refCode,
        timestamp: new Date(),
        campaign: 'G3'
      };
      
      await adminDb.collection('kol_recruits').doc(recruitment.id).set({
        ...recruitment,
        timestamp: new Date()
      });
    }

    // Create or update corresponding KOL in agv-protocol-app format
    const agvKolId = existingKol?.kolId || `AGV-KOL${refCode}`;
    
    if (existingKol) {
      // Update existing KOL
      await adminDb.collection('kols').doc(existingKol.id).update({
        name: applicationData.identity.displayName,
        walletAddress: applicationData.wallets[0]?.address?.toLowerCase() || '',
        email: applicationData.identity.email,
        g3KolId: kolId, // Link to g3_funding KOL
        updatedAt: new Date(),
      });
    } else {
      // Create new KOL
      await adminDb.collection('kols').add({
        kolId: agvKolId,
        name: applicationData.identity.displayName,
        walletAddress: applicationData.wallets[0]?.address?.toLowerCase() || '',
        email: applicationData.identity.email,
        target: 0,
        seed: 0,
        tree: 0,
        solar: 0,
        compute: 0,
        isPrimaryKOL,
        sponsorKolId,
        g3KolId: kolId, // Link to g3_funding KOL
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create or update mint events document
    const mintEventsRef = adminDb.collection('mintEvents').doc(agvKolId);
    const mintEventsDoc = await mintEventsRef.get();
    
    if (!mintEventsDoc.exists) {
      // Create new mint events document
      await mintEventsRef.set({
        kolId: agvKolId,
        seed: 0,
        tree: 0,
        solar: 0,
        compute: 0,
        perChain: {},
        events: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Update existing mint events document
      await mintEventsRef.update({
        updatedAt: new Date(),
      });
    }

  } catch (error) {
    console.error('Error creating KOL in protocol app:', error);
    throw error;
  }
}

// Helper function to map tier
function mapTierToProtocol(tier: string): 'pioneer' | 'ambassador' | 'partner' {
  switch (tier) {
    case 'fund_partner':
      return 'partner';
    case 'micro_kol':
      return 'ambassador';
    case 'contributor':
    case 'airdrop_hunter':
    default:
      return 'pioneer';
  }
}

// Helper function to extract username from URL
function extractUsernameFromUrl(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        return pathname.split('/')[1] || '';
      case 'telegram':
        return pathname.split('/')[1] || '';
      case 'youtube':
        return pathname.split('/')[1] || '';
      case 'instagram':
        return pathname.split('/')[1] || '';
      default:
        return pathname.split('/')[1] || '';
    }
  } catch {
    return '';
  }
}
