const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extractTextFromPdf(filePath, maxChars = 15000) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  let text = data.text || '';
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }
  return text;
}

module.exports = { extractTextFromPdf };