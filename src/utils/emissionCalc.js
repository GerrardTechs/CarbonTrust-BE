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
};

const SCOPE_MAP = {
  genset: 1, boiler: 1, furnace: 1, lpg: 1, naturalGas: 1, coal: 1,
  truck: 1, smallTruck: 1, opCar: 1, bus: 1, diesel: 1, petrol: 1,
  refrigerant: 1,
  electricity: 2, heatSteam: 2,
  freightRoad: 3, freightShip: 3, fuelDelivery: 3, bizTravel: 3, commuting: 3, waste: 3,
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
};

const UNITS = {
  genset: 'liter', boiler: 'liter', furnace: 'liter', lpg: 'kg',
  naturalGas: 'm3', coal: 'kg', truck: 'km', smallTruck: 'km',
  opCar: 'km', bus: 'km', diesel: 'liter', petrol: 'liter',
  refrigerant: 'kg', electricity: 'kWh', heatSteam: 'kWh',
  freightRoad: 'ton·km', freightShip: 'ton·km', fuelDelivery: 'km',
  bizTravel: 'km', commuting: 'km', waste: 'kg',
};

const calculateEmissions = ({ method = 'operational', equityPct = 100, inputs = {} }) => {
  const eqFactor = method === 'equity' ? equityPct / 100 : 1;
  const breakdown = [];
  let scope1 = 0, scope2 = 0, scope3 = 0;

  for (const [key, val] of Object.entries(inputs)) {
    if (!EF[key] || !val) continue;

    let emission;
    // Freight: km × tons × EF
    if (key === 'freightRoad') {
      emission = (val * (inputs.freightRoadTons || 1) * EF.freightRoad * eqFactor);
    } else if (key === 'freightShip') {
      emission = (val * (inputs.freightShipTons || 1) * EF.freightShip * eqFactor);
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

    breakdown.push({
      key,
      source: SOURCE_LABELS[key] || key,
      val,
      unit: UNITS[key] || '',
      ef: EF[key],
      emission,
      scope,
    });
  }

  scope1 = parseFloat(scope1.toFixed(4));
  scope2 = parseFloat(scope2.toFixed(4));
  scope3 = parseFloat(scope3.toFixed(4));
  const total = parseFloat((scope1 + scope2 + scope3).toFixed(4));
  const leakage = parseFloat((scope1 * 0.05 + scope3 * 0.10).toFixed(4));
  const creditsNeeded = Math.ceil(total / 1000);

  return { scope1, scope2, scope3, total, leakage, creditsNeeded, breakdown };
};

module.exports = { calculateEmissions, EF };
