/**
 * Emission factors (kg CO2e per unit)
 * Sources: IPCC, GHG Protocol, Indonesia national inventory
 */
const EF = {
  // Scope 1 - Stationary (per liter or kg or m3)
  genset: 2.68,       // liter solar → kg CO2e
  boiler: 2.68,       // liter solar
  furnace: 2.68,      // liter solar
  lpg: 2.98,          // kg LPG
  naturalGas: 2.04,   // m3
  coal: 2.42,         // kg coal

  // Scope 1 - Mobile (per km)
  truck: 0.21,        // km
  smallTruck: 0.16,   // km
  opCar: 0.12,        // km
  bus: 0.09,          // km (per km per passenger equiv)
  diesel: 2.68,       // liter
  petrol: 2.31,       // liter

  // Scope 1 - Fugitive
  refrigerant: 1430,  // kg HFC-134a (GWP)

  // Scope 2
  electricity: 0.87,  // kWh → kg CO2e (Indonesia grid avg)
  heatSteam: 0.27,    // kWh steam

  // Scope 3 (freight = per ton·km, travel = per km)
  freightRoad: 0.096, // ton·km
  freightShip: 0.012, // ton·km
  fuelDelivery: 0.096,// km
  bizTravel: 0.14,    // km (air avg)
  commuting: 0.09,    // km
  waste: 0.5,         // kg → landfill

  // Scope 3 - Tambahan (placeholder, sesuaikan dgn sumber resmi: DEFRA/IPCC/KLHK)
  water: 0.344,             // m3 → kg CO2e (treatment & supply, avg)
  plasticConsumption: 1.78, // kg → kg CO2e (generic plastic, avg)
  paperConsumption: 0.919,  // kg → kg CO2e (office paper, avg)
  electricityTD: 0.0435,    // kWh → kg CO2e (transmission & distribution loss)
  electricityWTT: 0.4841,   // kWh → kg CO2e (well-to-tank, placeholder)
};

const SCOPE_MAP = {
  genset: 1, boiler: 1, furnace: 1, lpg: 1, naturalGas: 1, coal: 1,
  truck: 1, smallTruck: 1, opCar: 1, bus: 1, diesel: 1, petrol: 1,
  refrigerant: 1,
  electricity: 2, heatSteam: 2,
  freightRoad: 3, freightShip: 3, fuelDelivery: 3, bizTravel: 3, commuting: 3, waste: 3,
  water: 3, plasticConsumption: 3, paperConsumption: 3,
  electricityTD: 3, electricityWTT: 3,
};

const SOURCE_LABELS = {
  genset: 'Genset (Solar)', boiler: 'Boiler (Solar)', furnace: 'Furnace (Solar)',
  lpg: 'LPG', naturalGas: 'Gas Alam', coal: 'Batu Bara',
  truck: 'Truk Besar', smallTruck: 'Truk Kecil', opCar: 'Kendaraan Operasional',
  bus: 'Bus', diesel: 'Bahan Bakar Diesel', petrol: 'Bensin',
  refrigerant: 'Refrigerant (Fugitif)',
  electricity: 'Listrik PLN', heatSteam: 'Panas/Uap',
  freightRoad: 'Pengiriman Darat', freightShip: 'Pengiriman Laut',
  fuelDelivery: 'Pengiriman BBM', bizTravel: 'Perjalanan Bisnis',
  commuting: 'Komutasi Karyawan', waste: 'Limbah Padat',
  water: 'Konsumsi Air', plasticConsumption: 'Konsumsi Plastik',
  paperConsumption: 'Konsumsi Kertas', electricityTD: 'Listrik T&D (Transmisi & Distribusi)',
  electricityWTT: 'Listrik WTT (Well-to-Tank)',
};

const UNITS = {
  genset: 'liter', boiler: 'liter', furnace: 'liter', lpg: 'kg',
  naturalGas: 'm3', coal: 'kg', truck: 'km', smallTruck: 'km',
  opCar: 'km', bus: 'km', diesel: 'liter', petrol: 'liter',
  refrigerant: 'kg', electricity: 'kWh', heatSteam: 'kWh',
  freightRoad: 'ton·km', freightShip: 'ton·km', fuelDelivery: 'km',
  bizTravel: 'km', commuting: 'km', waste: 'kg',
  water: 'm3', plasticConsumption: 'kg', paperConsumption: 'kg',
  electricityTD: 'kWh', electricityWTT: 'kWh',
};

// Helper: cek apakah suatu value valid untuk dipakai dalam kalkulasi
// (harus angka, finite, dan tidak negatif)
function isValidNumber(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

const calculateEmissions = ({ method = 'operational', equityPct = 100, inputs = {} }) => {
  const eqFactor = method === 'equity' ? equityPct / 100 : 1;
  const breakdown = [];
  const skipped = []; // field yang diabaikan karena nilainya tidak valid
  let scope1 = 0, scope2 = 0, scope3 = 0;

  for (const [key, val] of Object.entries(inputs)) {
    if (!EF[key] || !val) continue;

    // Validasi: kalau val bukan angka valid (NaN, negatif, string aneh), skip & catat
    if (!isValidNumber(val)) {
      skipped.push({ key, reason: 'invalid_value', value: val });
      continue;
    }

    let emission;
    let tons; // hanya terisi untuk freight, untuk transparansi breakdown

    // Freight: km × tons × EF
    if (key === 'freightRoad') {
      tons = inputs.freightRoadTons;
      if (tons !== undefined && !isValidNumber(tons)) {
        skipped.push({ key: 'freightRoadTons', reason: 'invalid_value', value: tons });
        tons = 1;
      } else {
        tons = tons || 1;
      }
      emission = (val * tons * EF.freightRoad * eqFactor);
    } else if (key === 'freightShip') {
      tons = inputs.freightShipTons;
      if (tons !== undefined && !isValidNumber(tons)) {
        skipped.push({ key: 'freightShipTons', reason: 'invalid_value', value: tons });
        tons = 1;
      } else {
        tons = tons || 1;
      }
      emission = (val * tons * EF.freightShip * eqFactor);
    } else if (key === 'freightRoadTons' || key === 'freightShipTons') {
      continue; // handled above
    } else {
      emission = val * EF[key] * eqFactor;
    }

    emission = parseFloat(emission.toFixed(4));
    const scope = SCOPE_MAP[key];
    if (scope === 1) scope1 += emission;
    else if (scope === 2) scope2 += emission;
    else scope3 += emission;

    const breakdownItem = {
      key,
      source: SOURCE_LABELS[key] || key,
      val,
      unit: UNITS[key] || '',
      ef: EF[key],
      emission,
      scope,
    };

    // Tambahan non-breaking: info tons & tonKm untuk freight agar unit "ton·km" akurat
    if (tons !== undefined) {
      breakdownItem.tons = tons;
      breakdownItem.tonKm = parseFloat((val * tons).toFixed(4));
    }

    breakdown.push(breakdownItem);
  }

  scope1 = parseFloat(scope1.toFixed(4));
  scope2 = parseFloat(scope2.toFixed(4));
  scope3 = parseFloat(scope3.toFixed(4));
  const total = parseFloat((scope1 + scope2 + scope3).toFixed(4));
  const leakage = parseFloat((scope1 * 0.05 + scope3 * 0.10).toFixed(4));
  const creditsNeeded = Math.ceil(total / 1000);

  return { scope1, scope2, scope3, total, leakage, creditsNeeded, breakdown, skipped };
};

module.exports = { calculateEmissions, EF };