import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, company, investmentType, message, nda } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize Brevo API client
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);

    // Email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #4FACFE; padding-bottom: 10px;">
          New Investment Inquiry
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #4FACFE; margin-top: 0;">Contact Information</h3>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          ${investmentType ? `<p><strong>Investment Type:</strong> ${investmentType}</p>` : ''}
          <p><strong>NDA Agreement:</strong> ${nda ? 'Yes' : 'No'}</p>
        </div>
        
        <div style="background-color: #fff; padding: 20px; border-left: 4px solid #4FACFE; margin: 20px 0;">
          <h3 style="color: #4FACFE; margin-top: 0;">Message</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>
        
        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Submitted:</strong> ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `;

    const textContent = `
      New Investment Inquiry from ${firstName} ${lastName}
      
      Contact Information:
      Name: ${firstName} ${lastName}
      Email: ${email}
      ${phone ? `Phone: ${phone}` : ''}
      ${company ? `Company: ${company}` : ''}
      ${investmentType ? `Investment Type: ${investmentType}` : ''}
      NDA Agreement: ${nda ? 'Yes' : 'No'}
      
      Message:
      ${message}
      
      Submitted: ${new Date().toLocaleString()}
    `;

    // Create email data
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = `New Investment Inquiry from ${firstName} ${lastName}`;
    sendSmtpEmail.htmlContent = emailContent;
    sendSmtpEmail.textContent = textContent;
    sendSmtpEmail.sender = { 
      name: `${firstName} ${lastName}`, 
      email: email 
    };
    sendSmtpEmail.to = [
      { 
        email: "contact@agvprotocol.org", 
        name: "AGV Protocol Contact" 
      },
      { 
        email: "IR@agvprotocol.org", 
        name: "AGV Protocol IR" 
      }
    ];
    sendSmtpEmail.replyTo = { 
      email: email, 
      name: `${firstName} ${lastName}` 
    };

    // Send email using Brevo
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
