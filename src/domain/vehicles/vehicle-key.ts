/**
 * Vehicle key extraction — normalizes lender-specific model names into a
 * canonical key so the same physical car can be matched across lenders.
 *
 * Examples:
 *   BMW  "520i"                              → "BMW_520I"
 *   BMW  "The New 5 Series 가솔린 2.0 520i"   → "BMW_520I"
 *   BENZ "E 220d 4Matic Exclusive"           → "BENZ_E220D"
 *   BENZ "The All New CLE … CLE 53 AMG …"   → "BENZ_CLE53"
 */

// ---------------------------------------------------------------------------
// BMW patterns
// ---------------------------------------------------------------------------

function extractBmwKey(model: string): string | null {
  const m = model.toUpperCase();

  // iX models: "iX xDrive40", "iX M60", BNK "The iX 전기 …"
  const ixMatch = m.match(/\bIX\s*(?:X?DRIVE\s*)?(\d{2})\b/);
  if (ixMatch) return `BMW_IX${ixMatch[1]}`;
  // plain iX with no number — bare "iX" without drive designation
  if (/\bIX\b/.test(m)) return "BMW_IX";

  // i-series: i4, i5, i7 — "i4 eDrive40", "The i5 전기 … eDrive40"
  const iSeriesMatch = m.match(/\bI(\d)\b/);
  if (iSeriesMatch) {
    const digit = iSeriesMatch[1];
    // Check it's a real i-series (i4, i5, i7) not a random "i" in text
    if (["4", "5", "7"].includes(digit)) return `BMW_I${digit}`;
  }

  // X-series: X1, X2, X3, X4, X5, X6, X7, XM
  // MG: "X7 xDrive 40d DPE (6인승)", "X5 xDrive 30d M Sport", "X3 xDrive 20d M Sport"
  // BNK: "The New X7 디젤 3.0 40d", "The New X3 디젤 2.0 20d"
  const xmMatch = m.match(/\bXM\b/);
  if (xmMatch) return "BMW_XM";

  const xSeriesMatch = m.match(/\bX(\d)\b/);
  if (xSeriesMatch) {
    const xNum = xSeriesMatch[1];
    // Extract engine designation after X-series: "40d", "30d", "20d", "20i"
    // MG: "X7 xDrive 40d" or "X5 30d" — designation near model
    // BNK: "The New X7 디젤 3.0 40d" — designation at end
    const engineMatch = m.match(/(?:^|\s|DRIVE)(\d{2}[DISE])\b/);
    if (engineMatch) {
      return `BMW_X${xNum}_${engineMatch[1]}`;
    }
    return `BMW_X${xNum}`;
  }

  // M-cars: M2, M3, M4, M5, M8
  const mCarMatch = m.match(/\bM(\d)\b/);
  if (mCarMatch) return `BMW_M${mCarMatch[1]}`;

  // Standard 3-digit designation: 320d, 520i, 730d, 840i, etc.
  // MG: "320d Sedan", "520i"
  // BNK: "The New 5 Series 가솔린 2.0 520i", "The New 3 Series 디젤 2.0 320d"
  const stdMatch = m.match(/\b(\d{3}[DIELSX])\b/);
  if (stdMatch) return `BMW_${stdMatch[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// BENZ / MERCEDES-BENZ patterns
// ---------------------------------------------------------------------------

function extractBenzKey(model: string): string | null {
  const m = model.toUpperCase();

  // EQ models: EQA, EQB, EQC, EQE, EQS — "EQE 350+"
  const eqMatch = m.match(/\bEQ([ABCES])\s*(\d{3})?\b/);
  if (eqMatch) {
    const suffix = eqMatch[2] ? eqMatch[2] : "";
    return `BENZ_EQ${eqMatch[1]}${suffix}`;
  }

  // Multi-letter class + digits: CLE53, CLA250, CLS450, GLC300, GLE350, GLS580, GLB250, AMG GT63
  // BNK: "The All New CLE 가솔린 3.0 AMG 카브리올레 CLE 53 AMG 4Matic+"
  // Look for the pattern: 2-3 letter class + space? + 2-3 digits
  const multiMatch = m.match(/\b(CL[AES]|GL[ABCES]|SL[CK]?|AMG\s*GT|GT)\s*(\d{2,3})/);
  if (multiMatch) {
    const cls = multiMatch[1].replace(/\s+/g, "");
    return `BENZ_${cls}${multiMatch[2]}`;
  }

  // Single-letter class + 3 digits + optional letter: E220D, A200D, S500, C300D
  // MG: "E 220d 4Matic Exclusive", "A 200d Sedan"
  // BNK: may have "E 220d" embedded in longer string
  const singleMatch = m.match(/\b([A-Z])\s*(\d{3})([DEIL])?\b/);
  if (singleMatch) {
    const letter = singleMatch[3] || "";
    return `BENZ_${singleMatch[1]}${singleMatch[2]}${letter}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// AUDI patterns
// ---------------------------------------------------------------------------

function extractAudiKey(model: string): string | null {
  const m = model.toUpperCase();

  // e-tron models: "e-tron GT", "Q4 e-tron", "Q8 e-tron"
  const etronMatch = m.match(/\b(Q[48])?\s*E-?TRON\s*(GT|S)?\b/);
  if (etronMatch) {
    const prefix = etronMatch[1] || "";
    const suffix = etronMatch[2] || "";
    const key = [prefix, "ETRON", suffix].filter(Boolean).join("_");
    return `AUDI_${key}`;
  }

  // RS models: RS3, RS4, RS5, RS6, RS7, RS Q8
  const rsMatch = m.match(/\bRS\s*([Q]?\d)\b/);
  if (rsMatch) return `AUDI_RS${rsMatch[1]}`;

  // S models: S3, S4, S5, S6, S7, S8, SQ5, SQ7, SQ8
  const sMatch = m.match(/\bS\s*([Q]?\d)\b/);
  if (sMatch) return `AUDI_S${sMatch[1]}`;

  // TT and R8
  if (/\bTT\b/.test(m)) return "AUDI_TT";
  if (/\bR8\b/.test(m)) return "AUDI_R8";

  // Standard model lines: A1-A8, Q2-Q8
  // MG: "A3 40 TFSI Premium"
  // BNK: "The New A7 디젤 3.0 50 TDI Quattro Premium"
  const stdMatch = m.match(/\b([AQ])(\d)\b/);
  if (stdMatch) return `AUDI_${stdMatch[1]}${stdMatch[2]}`;

  return null;
}

// ---------------------------------------------------------------------------
// VOLVO patterns
// ---------------------------------------------------------------------------

function extractVolvoKey(model: string): string | null {
  const m = model.toUpperCase();

  // EX30, EX90, EC40 (electric)
  const exMatch = m.match(/\b(EX|EC)(\d{2})\b/);
  if (exMatch) return `VOLVO_${exMatch[1]}${exMatch[2]}`;

  // XC40, XC60, XC90, S60, S90, V60, V90, C40, C30
  const stdMatch = m.match(/\b(XC|[SVC])(\d{2})\b/);
  if (stdMatch) return `VOLVO_${stdMatch[1]}${stdMatch[2]}`;

  return null;
}

// ---------------------------------------------------------------------------
// LEXUS patterns
// ---------------------------------------------------------------------------

function extractLexusKey(model: string): string | null {
  const m = model.toUpperCase();

  // Models: RX350H, ES300H, NX350H, IS300H, LS500H, LC500, UX300E, LBX
  // MG: "RX 350h"
  const lexMatch = m.match(/\b([A-Z]{2,3})\s*(\d{3})([HE])?\b/);
  if (lexMatch) {
    const suffix = lexMatch[3] || "";
    return `LEXUS_${lexMatch[1]}${lexMatch[2]}${suffix}`;
  }

  // LBX (no numbers)
  if (/\bLBX\b/.test(m)) return "LEXUS_LBX";

  return null;
}

// ---------------------------------------------------------------------------
// GENESIS patterns
// ---------------------------------------------------------------------------

function extractGenesisKey(model: string): string | null {
  const m = model.toUpperCase();

  // GV60, GV70, GV80, G70, G80, G90
  const stdMatch = m.match(/\b(GV|G)(\d{2})\b/);
  if (stdMatch) return `GENESIS_${stdMatch[1]}${stdMatch[2]}`;

  return null;
}

// ---------------------------------------------------------------------------
// HYUNDAI / KIA — generic fallback
// ---------------------------------------------------------------------------

function extractGenericKey(brand: string, model: string): string | null {
  // Take the first alphanumeric token as the key
  const m = model.toUpperCase().trim();
  const firstToken = m.match(/^([A-Z0-9]+)/);
  if (firstToken) return `${brand.toUpperCase()}_${firstToken[1]}`;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const BRAND_ALIASES: Record<string, string> = {
  "MERCEDES-BENZ": "BENZ",
  "MERCEDES": "BENZ",
};

function normalizeBrand(brand: string): string {
  const upper = brand.toUpperCase().trim();
  return BRAND_ALIASES[upper] ?? upper;
}

/**
 * Extract a normalized vehicle key from a lender-specific model name.
 *
 * @returns e.g. "BMW_520I", "BENZ_E220D", "VOLVO_XC40", or null if no pattern matched.
 */
export function extractVehicleKey(
  brand: string,
  modelName: string,
): string | null {
  const b = normalizeBrand(brand);

  switch (b) {
    case "BMW":
      return extractBmwKey(modelName);
    case "BENZ":
      return extractBenzKey(modelName);
    case "AUDI":
      return extractAudiKey(modelName);
    case "VOLVO":
      return extractVolvoKey(modelName);
    case "LEXUS":
      return extractLexusKey(modelName);
    case "GENESIS":
      return extractGenesisKey(modelName);
    case "HYUNDAI":
    case "KIA":
      return extractGenericKey(b, modelName);
    default:
      return null;
  }
}

/**
 * Given an array of candidate vehicles, find the one whose vehicleKey matches
 * the requested model's vehicleKey.
 *
 * @returns The matching candidate, or null if no match found.
 */
export function resolveModelNameByVehicleKey<
  T extends { brand: string; modelName: string },
>(
  brand: string,
  requestedModelName: string,
  candidates: T[],
): T | null {
  const requestedKey = extractVehicleKey(brand, requestedModelName);
  if (!requestedKey) return null;

  for (const candidate of candidates) {
    const candidateKey = extractVehicleKey(candidate.brand, candidate.modelName);
    if (candidateKey === requestedKey) return candidate;
  }

  return null;
}
