const https = require('https');

const sendOTPEmail = async (toEmail, otp) => {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in environment variables');
  }

  const emailData = JSON.stringify({
    from: 'Noble High School <onboarding@resend.dev>',
    to: [toEmail],
    subject: 'Noble High School - Admin Portal Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a3a6b; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">NOBLE HIGH SCHOOL</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #c8a951;">Admin Verification</p>
        </div>
        <div style="padding: 24px; background: white; color: #333;">
          <p>Hello Admin,</p>
          <p>Use the following OTP to complete your login:</p>
          <div style="background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a3a6b;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #718096;">This OTP is valid for 5 minutes.</p>
        </div>
      </div>
    `
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`OTP email sent successfully to ${toEmail}. ID: ${parsed.id}`);
          resolve(parsed);
        } else {
          reject(new Error(`Resend API error: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(emailData);
    req.end();
  });
};

module.exports = { sendOTPEmail };
