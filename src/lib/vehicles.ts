/**
 * Controlled make/model lists for the vehicle step. Manual entry is still
 * allowed in the UI; these just power the typeahead.
 */

export const MAKES = [
  "Acura",
  "Audi",
  "BMW",
  "Chevrolet",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Nissan",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

export const MODELS_BY_MAKE: Record<string, string[]> = {
  Acura: ["MDX", "RDX", "TLX", "ILX", "Integra"],
  Audi: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7"],
  BMW: ["3 Series", "5 Series", "X1", "X3", "X5", "i3", "i4", "iX"],
  Chevrolet: ["Cruze", "Malibu", "Equinox", "Traverse", "Tahoe", "Silverado"],
  Dodge: ["Charger", "Challenger", "Durango", "Grand Caravan"],
  Ford: ["F-150", "Escape", "Edge", "Explorer", "Mustang", "Ranger"],
  GMC: ["Sierra", "Terrain", "Acadia", "Yukon"],
  Honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Odyssey"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Kona", "Palisade"],
  Jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Renegade"],
  Kia: ["Forte", "Optima", "K5", "Sportage", "Sorento", "Telluride"],
  Lexus: ["IS", "ES", "RX", "NX", "GX"],
  Mazda: ["Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLA", "GLC", "GLE"],
  Nissan: ["Sentra", "Altima", "Rogue", "Murano", "Pathfinder"],
  Subaru: ["Impreza", "Crosstrek", "Forester", "Outback", "WRX"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: ["Corolla", "Camry", "RAV4", "Highlander", "Tacoma", "Prius"],
  Volkswagen: ["Jetta", "Golf", "Tiguan", "Atlas", "Passat"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
};

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 22 }, (_, i) => String(CURRENT_YEAR - i));
