// api/verify-agent-application.js

export default async function handler(req, res) {
  try {
    const { email } = req.body; // or wallet, depending on your form

    if (!email) {
      return res.status(400).json({ isValid: false, reason: "Missing identifier" });
    }

    // Call Tally API
    const response = await fetch(`https://api.tally.so/forms/${process.env.TALLY_FORM_ID}/responses`, {
      headers: {
        "Authorization": `Bearer ${process.env.TALLY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Tally responses");
    }

    const data = await response.json();

    // Check if user submitted
    const found = data.data.some((submission) => {
      return Object.values(submission.answers).some(
        (answer) => typeof answer === "string" && answer.toLowerCase() === email.toLowerCase()
      );
    });

    res.status(200).json({ isValid: found });
  } catch (err) {
    res.status(500).json({ isValid: false, error: err.message });
  }
}
