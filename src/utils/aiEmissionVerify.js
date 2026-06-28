const AI_BASE_URL = process.env.AI_BASE_URL;
const AI_API_KEY  = process.env.AI_API_KEY;
const AI_MODEL    = process.env.AI_MODEL || 'openai/gpt-4o-mini';

/**
 * Minta LLM mengekstrak total emisi (tCO2e) dari teks laporan verifikasi.
 * Selalu minta output JSON murni agar mudah di-parse.
 */
async function extractEmissionFromText(reportText) {
  if (!AI_BASE_URL || !AI_API_KEY) {
    console.warn('[AI Verify] ⚠️  AI_BASE_URL/AI_API_KEY belum dikonfigurasi di .env');
    return { found: false, error: 'AI not configured' };
  }

  const systemPrompt = `Kamu adalah asisten yang membaca dokumen laporan verifikasi emisi karbon (ISO 14064-3, GHG Protocol, dsb).
Tugasmu HANYA mengekstrak angka TOTAL emisi karbon dari teks yang diberikan.
Balas HANYA dalam format JSON murni, tanpa markdown, tanpa penjelasan tambahan, dengan struktur:
{
  "found": true atau false,
  "totalEmission": angka (atau null jika tidak ditemukan),
  "unit": "tCO2e" atau "kgCO2e" atau "other",
  "companyName": "nama perusahaan jika disebutkan, atau null",
  "reportPeriod": "periode laporan jika disebutkan, atau null"
}
Jika ada beberapa angka total (misal per scope dan grand total), ambil GRAND TOTAL keseluruhan (bukan per-scope).`;

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 500,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: reportText },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Verify] ❌ HTTP error:', response.status, errText);
      return { found: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error('[AI Verify] ❌ Exception:', err.message);
    return { found: false, error: err.message };
  }
}

/**
 * Konversi nilai ke tCO2e supaya bisa dibandingkan secara konsisten.
 */
function normalizeToTonnes(value, unit) {
  if (unit === 'kgCO2e') return value / 1000;
  return value; // anggap sudah tCO2e
}

/**
 * Bandingkan total dari AI (PDF) dengan total dari EmissionRecord (kg CO2e di DB).
 * Toleransi default 5% — sama seperti materiality threshold standar ISO 14064-3.
 */
function compareEmissions(aiResult, recordTotalKg, tolerancePct = 5) {
  if (!aiResult.found || aiResult.totalEmission === null || aiResult.totalEmission === undefined) {
    return { match: false, reason: 'AI tidak menemukan angka total emisi di dokumen' };
  }
  if (!recordTotalKg || recordTotalKg <= 0) {
    return { match: false, reason: 'Tidak ada data EmissionRecord untuk dibandingkan' };
  }

  const aiTonnes = normalizeToTonnes(aiResult.totalEmission, aiResult.unit);
  const recordTonnes = recordTotalKg / 1000;

  const diffPct = Math.abs(aiTonnes - recordTonnes) / recordTonnes * 100;
  const match = diffPct <= tolerancePct;

  return {
    match,
    aiTonnes: parseFloat(aiTonnes.toFixed(4)),
    recordTonnes: parseFloat(recordTonnes.toFixed(4)),
    diffPct: parseFloat(diffPct.toFixed(2)),
    tolerancePct,
  };
}

module.exports = { extractEmissionFromText, compareEmissions };