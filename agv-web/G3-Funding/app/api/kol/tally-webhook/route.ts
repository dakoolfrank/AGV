import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { KOLProfile, KOLRecruitment } from '@/lib/types';
import { generateReferralCodes } from '@/lib/rewards-engine';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface TallyWebhookPayload {
  eventId: string;
  eventType: 'FORM_RESPONSE';
  createdAt: string;
  data: {
    responseId: string;
    submissionId: string;
    respondentId: string;
    formId: string;
    formName: string;
    createdAt: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      value: any;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: TallyWebhookPayload = await request.json();
    
    // Validate webhook signature if needed
    // const signature = request.headers.get('tally-signature');
    // if (!validateSignature(payload, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }
    
    const fields = payload.data.fields;
    const fieldMap = fields.reduce((acc, field) => {
      acc[field.key] = field.value;
      return acc;
    }, {} as Record<string, any>);
    
    // Extract form data
    const tier = fieldMap.tier || 'pioneer';
    const displayName = fieldMap.displayName || fieldMap.name;
    const email = fieldMap.email;
    const wallet = fieldMap.wallet;
    const region = Array.isArray(fieldMap.region) ? fieldMap.region : [fieldMap.region];
    const languages = Array.isArray(fieldMap.languages) ? fieldMap.languages : [fieldMap.languages];
    const sponsorRef = fieldMap.sponsorRef || fieldMap.referralCode;
    
    // Parse social media channels
    const socials = [];
    if (fieldMap.twitterUrl) {
      socials.push({
        platform: 'twitter',
        url: fieldMap.twitterUrl,
        username: extractUsernameFromUrl(fieldMap.twitterUrl, 'twitter'),
        followers: parseInt(fieldMap.twitterFollowers) || 0,
        verified: false
      });
    }
    if (fieldMap.telegramUrl) {
      socials.push({
        platform: 'telegram',
        url: fieldMap.telegramUrl,
        username: extractUsernameFromUrl(fieldMap.telegramUrl, 'telegram'),
        followers: parseInt(fieldMap.telegramFollowers) || 0,
        verified: false
      });
    }
    
    // Generate KOL ID and unified referral code
    const kolId = uuidv4();
    const refCode = generateReferralCode(kolId);
    
    // Create KOL profile
    const kolProfile: KOLProfile = {
      id: kolId,
      tier: tier as any,
      status: 'pending',
      refCode: refCode,
      sponsorRef: sponsorRef,
      displayName,
      email,
      wallet,
      region,
      languages,
      socials,
      createdAt: new Date(),
      updatedAt: new Date(),
      campaign: 'G3'
    };
    
    // Save to Firestore
    await db.collection('kol_profiles').doc(kolId).set({
      ...kolProfile,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // If there's a sponsor, create recruitment record
    if (sponsorRef) {
      const sponsorQuery = await db.collection('kol_profiles')
        .where('refCode', '==', sponsorRef)
        .limit(1)
        .get();
      
      if (!sponsorQuery.empty) {
        const sponsorDoc = sponsorQuery.docs[0];
        const sponsorKolId = sponsorDoc.id;
        
        const recruitment: KOLRecruitment = {
          id: uuidv4(),
          sponsorKolId,
          childKolId: kolId,
          sponsorRef,
          childRef: refCode,
          timestamp: new Date(),
          campaign: 'G3'
        };
        
        await db.collection('kol_recruits').doc(recruitment.id).set({
          ...recruitment,
          timestamp: new Date()
        });
      }
    }
    
    // Send welcome email with referral links
    await sendWelcomeEmail(kolProfile);
    
    return NextResponse.json({ 
      success: true, 
      kolId,
      refCode,
      referralLinks: {
        userMints: `https://agvprotocol.org/mint/${refCode}`,
        kolRecruitment: `https://g3fund.org/contributor-application?ref=${refCode}`
      }
    });
    
  } catch (error) {
    console.error('Tally webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

function extractUsernameFromUrl(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    if (platform === 'twitter') {
      // Extract from twitter.com/username or x.com/username
      const match = pathname.match(/^\/([^\/]+)/);
      return match ? match[1] : '';
    } else if (platform === 'telegram') {
      // Extract from t.me/username
      const match = pathname.match(/^\/([^\/]+)/);
      return match ? match[1] : '';
    }
    
    return '';
  } catch {
    return '';
  }
}

async function sendWelcomeEmail(kolProfile: KOLProfile) {
  // TODO: Implement email sending logic
  // This could use SendGrid, AWS SES, or another email service
  console.log('Sending welcome email to:', kolProfile.email);
  console.log('User referral link:', `https://g3fund.org/mint?ref=${kolProfile.refCode_user}`);
  console.log('KOL recruitment link:', `https://g3fund.org/join?ref=${kolProfile.refCode_kol}`);
}
