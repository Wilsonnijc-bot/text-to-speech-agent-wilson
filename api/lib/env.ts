import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function envDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/** Parse comma-separated voice IDs from env */
function parseVoiceList(): { id: string; name: string }[] {
  const idsRaw = process.env["ELEVENLABS_VOICE_IDS"];
  const namesRaw = process.env["ELEVENLABS_VOICE_NAMES"];

  if (idsRaw) {
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const names = namesRaw
      ? namesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return ids.map((id, i) => ({ id, name: names[i] || `Voice ${i + 1}` }));
  }

  // Fallback to single legacy voice ID
  const legacyId = process.env["ELEVENLABS_VOICE_ID"];
  if (legacyId) {
    return [{ id: legacyId, name: "Default" }];
  }

  return [];
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  elevenlabsApiKey: required("ELEVENLABS_API_KEY"),
  elevenlabsVoiceList: parseVoiceList(),
  elevenlabsModelId: envDefault("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
  elevenlabsOutputFormat: envDefault("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"),
  openrouterApiKey: required("OPENROUTER_API_KEY"),
};
