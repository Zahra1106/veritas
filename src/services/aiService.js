const fetch = require('node-fetch');
const fs = require('fs');

/* -------------------------------------------------------------------------
 * 1) AI-GENERATED IMAGE DETECTION
 * Uses Hugging Face's free Inference API with a public AI-image-detector
 * model. Requires a free HUGGINGFACE_API_KEY (https://huggingface.co/settings/tokens).
 * Falls back to an "inconclusive" result if the API key is missing or the
 * call fails, rather than fabricating a confidence score.
 * ---------------------------------------------------------------------- */
async function analyzeImageAI(filePath) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HF_IMAGE_MODEL || 'Organika/sdxl-detector';

  if (!apiKey || apiKey.includes('xxxx')) {
    return {
      status: 'inconclusive',
      reason: 'AI detection model not configured (missing HUGGINGFACE_API_KEY).',
      aiGenerationProbability: null,
      signals: ['AI-generation model unavailable — add a free Hugging Face API key to enable this check.']
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        status: 'inconclusive',
        reason: `Model call failed: ${response.status} ${errText.slice(0, 200)}`,
        aiGenerationProbability: null,
        signals: ['The AI-detection model did not return a result. Treat this file as inconclusive.']
      };
    }

    const result = await response.json();
    // Typical HF image-classification output: [{label: "artificial", score: 0.87}, {label: "human", score: 0.13}]
    const artificial = Array.isArray(result)
      ? result.find(r => /artificial|ai|fake|generated/i.test(r.label))
      : null;

    const probability = artificial ? Math.round(artificial.score * 100) : null;

    const signals = [];
    if (probability !== null) {
      signals.push(`Model classified this image as "${artificial.label}" with ${probability}% confidence.`);
    }

    return {
      status: 'completed',
      rawModelOutput: result,
      aiGenerationProbability: probability,
      signals
    };
  } catch (err) {
    return {
      status: 'inconclusive',
      reason: err.message,
      aiGenerationProbability: null,
      signals: ['AI-detection service could not be reached. Result is inconclusive, not a verdict.']
    };
  }
}

/* -------------------------------------------------------------------------
 * 2) TEXT RISK CLASSIFIER (chat / conversation risk indicators)
 * A transparent, explainable rule-based classifier — free, deterministic,
 * and auditable. Each category contributes a weighted score; the total
 * produces a 0-100 risk score and a list of the categories that fired.
 * This is intentionally rule-based (not a black-box model) so every result
 * can be explained back to the user, per the platform's explainability goal.
 * ---------------------------------------------------------------------- */
const RISK_CATEGORIES = [
  {
    key: 'threat',
    label: 'Threatening language',
    weight: 30,
    patterns: [/\bkill you\b/i, /\bhurt you\b/i, /\bmake you pay\b/i, /\byou'?ll regret\b/i, /\bwatch out\b/i, /\bor else\b/i]
  },
  {
    key: 'financial_pressure',
    label: 'Pressure for money',
    weight: 25,
    patterns: [/\bsend (me )?(money|cash|\$)/i, /\btransfer (me )?(money|funds|\$)/i, /\bpay (me|up)\b/i, /\bgift card\b/i, /\bwire transfer\b/i, /\bbitcoin\b|\bcrypto\b/i]
  },
  {
    key: 'urgency_deadline',
    label: 'Urgency / deadline pressure',
    weight: 10,
    patterns: [/\btoday or\b/i, /\btonight or\b/i, /\bhours? left\b/i, /\blast chance\b/i, /\bact now\b/i, /\bdeadline\b/i]
  },
  {
    key: 'exposure_threat',
    label: 'Threat to expose or share content',
    weight: 25,
    patterns: [/\bpost (it|these|this) (everywhere|online)\b/i, /\bshare (it|these) with\b/i, /\bleak\b/i, /\beveryone will see\b/i, /\bsend to your (family|friends|boss|contacts)\b/i]
  },
  {
    key: 'coercion',
    label: 'Coercive / controlling behavior',
    weight: 15,
    patterns: [/\bdo (what|as) I say\b/i, /\byou have no choice\b/i, /\bdon'?t tell anyone\b/i, /\bkeep this (a )?secret\b/i, /\bdelete (this|our) (chat|conversation)\b/i]
  },
  {
    key: 'impersonation',
    label: 'Possible impersonation indicators',
    weight: 15,
    patterns: [/\bthis is (the )?(police|fbi|irs|bank|support team)\b/i, /\bverify your account\b/i, /\bofficial (notice|warning)\b/i]
  }
];

function analyzeTextRisk(text) {
  if (!text || !text.trim()) {
    return { riskScore: 0, riskLevel: 'low', signals: [], categoriesTriggered: [] };
  }

  let score = 0;
  const signals = [];
  const categoriesTriggered = [];

  for (const category of RISK_CATEGORIES) {
    const hit = category.patterns.some((re) => re.test(text));
    if (hit) {
      score += category.weight;
      signals.push(`${category.label} detected`);
      categoriesTriggered.push(category.key);
    }
  }

  score = Math.min(score, 100);
  const riskLevel = score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';

  return { riskScore: score, riskLevel, signals, categoriesTriggered };
}

module.exports = { analyzeImageAI, analyzeTextRisk };
