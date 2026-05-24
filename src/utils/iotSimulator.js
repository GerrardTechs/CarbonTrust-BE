/**
 * Generate 216 simulated IoT data points (~9 days, every hour)
 */
const generateIotHistory = (parcel) => {
  const data = [];
  const now = Date.now();
  const baseTemp = 28 + Math.random() * 5;
  const baseHum = parcel.humidity || 70;
  const baseCo2 = 400 + Math.random() * 100;
  const baseNdvi = parcel.ndvi || 0.70;

  for (let i = 215; i >= 0; i--) {
    data.push({
      ts: new Date(now - i * 60 * 60 * 1000),
      temp: parseFloat((baseTemp + (Math.random() - 0.5) * 4).toFixed(2)),
      hum: parseFloat((baseHum + (Math.random() - 0.5) * 10).toFixed(2)),
      co2: parseFloat((baseCo2 + (Math.random() - 0.5) * 50).toFixed(2)),
      ndvi: parseFloat((baseNdvi + (Math.random() - 0.5) * 0.1).toFixed(3)),
    });
  }
  return data;
};

module.exports = { generateIotHistory };
