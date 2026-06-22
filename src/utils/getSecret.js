const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Secure secret resolution following multi-tiered fallback:
 * 1. Environment variable
 * 2. Local file query
 * 3. Ephemeral random generation + warning
 */
function getSecret(envKey, fileFallback) {
  // Tier 1: Environment variable
  if (process.env[envKey]) {
    return process.env[envKey];
  }

  // Tier 2: Local file fallback
  if (fileFallback) {
    const filePath = path.resolve(__dirname, '..', '..', fileFallback);
    if (fs.existsSync(filePath)) {
      const secret = fs.readFileSync(filePath, 'utf-8').trim();
      if (secret) return secret;
    }
  }

  // Tier 3: Ephemeral random generation with warning
  console.warn(
    `[SECURITY WARNING] ${envKey} not found in environment or file. ` +
    `Generating ephemeral secret. This instance is isolated and sessions ` +
    `will not persist across restarts or scale horizontally.`
  );
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { getSecret };
