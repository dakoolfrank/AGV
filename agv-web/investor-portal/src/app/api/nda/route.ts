import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

interface BrevoError {
  status?: number;
  message?: string;
  response?: {
    data?: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, title, organization, email } = body;

    // Validate required fields
    if (!name || !title || !organization || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save to database
    try {
      const now = FieldValue.serverTimestamp();
      const ndaRequest = {
        name,
        title,
        organization,
        email,
        status: 'pending' as const,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await adminDb.collection('ndaRequests').add(ndaRequest);
      console.log('NDA request saved to database with ID:', docRef.id);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with email sending even if database save fails
    }

    // Check if Brevo API key is configured
    if (!process.env.BREVO_API_KEY) {
      console.error('BREVO_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    console.log('Brevo API Key configured:', process.env.BREVO_API_KEY ? 'Yes' : 'No');
    console.log('API Key length:', process.env.BREVO_API_KEY?.length);

    // Initialize Brevo API client
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    // Email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #3399FF; padding-bottom: 10px;">
          NDA Request - AGV NEXRUR
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #3399FF; margin-top: 0;">Requestor Information</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Organization:</strong> ${organization}</p>
          <p><strong>Email:</strong> ${email}</p>
        </div>
        
        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #3399FF; margin-top: 0;">Request Details</h3>
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Request Type:</strong> Non-Disclosure Agreement (NDA)
          </p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
            <strong>Submitted:</strong> ${new Date().toLocaleString()}
          </p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">Next Steps</h4>
          <p style="margin: 0; color: #856404; font-size: 14px;">
            Please review this NDA request and send the appropriate NDA document to the requestor at <strong>${email}</strong>.
          </p>
        </div>
      </div>
    `;

    const textContent = `
      NDA Request - AGV NEXRUR
      
      Requestor Information:
      Name: ${name}
      Title: ${title}
      Organization: ${organization}
      Email: ${email}
      
      Request Details:
      Request Type: Non-Disclosure Agreement (NDA)
      Submitted: ${new Date().toLocaleString()}
      
      Next Steps:
      Please review this NDA request and send the appropriate NDA document to the requestor at ${email}.
    `;

    // Read NDA file for attachment
    let ndaFileContent = null;
    const ndaFileName = 'NON-DISCLOSURE AGREEMENT.docx';
    try {
      const ndaFilePath = path.join(process.cwd(), 'NON-DISCLOSURE AGREEMENT.docx');
      ndaFileContent = fs.readFileSync(ndaFilePath);
    } catch (fileError) {
      console.error('Error reading NDA file:', fileError);
      // Continue without attachment if file not found
    }

    // Email content for the requester (with NDA document)
    const requesterEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #3399FF; padding-bottom: 10px;">
          NDA Document - AGV NEXRUR
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #3399FF; margin-top: 0;">Dear ${name},</h3>
          <p>Thank you for your interest in AGV NEXRUR. Please find attached the Non-Disclosure Agreement document for your review and signature.</p>
          <p>If you have any questions about the agreement or need further information, please don't hesitate to contact us.</p>
        </div>
        
        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #3399FF; margin-top: 0;">Next Steps</h3>
          <p style="margin: 0; color: #666; font-size: 14px;">
            1. Review the attached NDA document<br>
            2. Sign and return the document to us<br>
            3. We will process your request and provide access to confidential materials
          </p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">Contact Information</h4>
          <p style="margin: 0; color: #856404; font-size: 14px;">
            For any questions, please contact us at <strong>frank@agvnexrur.ai</strong>
          </p>
        </div>
      </div>
    `;

    const requesterTextContent = `
      NDA Document - AGV NEXRUR
      
      Dear ${name},
      
      Thank you for your interest in AGV NEXRUR. Please find attached the Non-Disclosure Agreement document for your review and signature.
      
      If you have any questions about the agreement or need further information, please don't hesitate to contact us.
      
      Next Steps:
      1. Review the attached NDA document
      2. Sign and return the document to us
      3. We will process your request and provide access to confidential materials
      
      For any questions, please contact us at frank@agvnexrur.ai
    `;

    // Send email to requester with NDA document when available. If the
    // attachment is missing, still send the email without it so the
    // requester receives confirmation and next steps.
    try {
      const requesterEmail = new brevo.SendSmtpEmail();
      requesterEmail.subject = `NDA Document - AGV NEXRUR`;
      requesterEmail.htmlContent = requesterEmailContent;
      requesterEmail.textContent = requesterTextContent;
      requesterEmail.sender = { 
        name: "AGV NEXRUR", 
        email: "frank@agvnexrur.ai" 
      };
      requesterEmail.to = [
        { 
          email: email, 
          name: name 
        }
      ];
      if (ndaFileContent) {
        requesterEmail.attachment = [
          {
            content: ndaFileContent.toString('base64'),
            name: ndaFileName
          }
        ];
      }

      await apiInstance.sendTransacEmail(requesterEmail);
      console.log('Requester email sent successfully');
    } catch (requesterError) {
      console.error('Error sending email to requester:', requesterError);
      // Continue with admin notification even if requester email fails
    }

    // Send email to admins with request details (no attachment)
    try {
      const adminEmail = new brevo.SendSmtpEmail();
      adminEmail.subject = `NDA Request from ${name} (${organization})`;
      adminEmail.htmlContent = emailContent;
      adminEmail.textContent = textContent;
      // Use a verified sender to avoid provider rejection; keep user in reply-to
      adminEmail.sender = { 
        email: "frank@agvnexrur.ai",
        name: "AGV NEXRUR IR"
      };
      adminEmail.to = [
        {
          email: "frank@agvnexrur.ai",
          name: "AGV NEXRUR IR"
        }
      ];
      adminEmail.cc = [
        { 
          email: "frank@agvnexrur.ai", 
          name: "AGV NEXRUR Contact" 
        }
      ];
      adminEmail.replyTo = { 
        email: email, 
        name: `${name}` 
      };

      await apiInstance.sendTransacEmail(adminEmail);
      console.log('Admin notification sent successfully');
    } catch (adminError: unknown) {
      console.error('Brevo API error for admin notification:', adminError);
      
      // Type-safe error handling
      if (adminError && typeof adminError === 'object' && 'status' in adminError) {
        const error = adminError as BrevoError;
        console.error('Brevo error details:', {
          status: error.status,
          message: error.message,
          response: error.response?.data
        });
      }
      
      // Return error if admin email sending fails
      return NextResponse.json(
        { error: 'Failed to send admin notification. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'NDA request submitted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending NDA request email:', error);
    return NextResponse.json(
      { error: 'Failed to submit NDA request' },
      { status: 500 }
    );
  }
}
