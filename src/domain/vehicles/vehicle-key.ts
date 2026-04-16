/**
 * Vehicle key extraction — normalizes lender-specific model names into a
 * canonical key so the same physical car can be matched across lenders.
 *
 * Handles the fact that MG uses English brand names ("AUDI", "BENZ", "PORSCHE")
 * while BNK uses Korean ("아우디", "벤츠", "포르쉐").  Both sides normalize to
 * the same canonical brand, and the vehicle key pattern is extracted from the
 * model designation (320d, M340i, iX M60, Cayenne Coupe, etc.).
 *
 * Examples:
 *   BMW  "520i"                              → "BMW_520I"
 *   BMW  "The New 5 Series 가솔린 2.0 520i"   → "BMW_520I"
 *   BMW  "M340i Sedan"                       → "BMW_M340I"
 *   BMW  "iX M60"                            → "BMW_IX_M60"
 *   BENZ "E 220d 4Matic Exclusive"           → "BENZ_E220D"
 *   PORSCHE "911 Carrera Coupe"              → "PORSCHE_911_CARRERA"
 *   MINI "MINI Clubman Cooper S"             → "MINI_CLUBMAN_COOPER_S"
 */

// ---------------------------------------------------------------------------
// Brand alias table (English ↔ Korean) — both lender workbooks normalize here
// ---------------------------------------------------------------------------

const BRAND_ALIASES: Record<string, string> = {
  AUDI: "AUDI",
  아우디: "AUDI",

  BMW: "BMW",

  BENZ: "BENZ",
  "MERCEDES-BENZ": "BENZ",
  MERCEDES: "BENZ",
  벤츠: "BENZ",

  BENTLEY: "BENTLEY",
  벤틀리: "BENTLEY",

  CADILLAC: "CADILLAC",
  캐딜락: "CADILLAC",

  FORD: "FORD",

  FERRARI: "FERRARI",
  페라리: "FERRARI",

  GENESIS: "GENESIS",
  제네시스: "GENESIS",

  HONDA: "HONDA",
  혼다: "HONDA",

  HYUNDAI: "HYUNDAI",
  현대: "HYUNDAI",

  "JAGUAR-LANDROVER": "LANDROVER",
  JAGUAR: "LANDROVER",
  LANDROVER: "LANDROVER",
  "LAND ROVER": "LANDROVER",
  랜드로버: "LANDROVER",

  JEEP: "JEEP",
  지프: "JEEP",

  KIA: "KIA",
  기아: "KIA",

  LAMBORGHINI: "LAMBORGHINI",
  람보르기니: "LAMBORGHINI",

  LEXUS: "LEXUS",
  렉서스: "LEXUS",

  LINCOLN: "LINCOLN",

  MASERATI: "MASERATI",
  마세라티: "MASERATI",

  MINI: "MINI",
  미니: "MINI",

  PEUGEOT: "PEUGEOT",
  푸조: "PEUGEOT",

  PORSCHE: "PORSCHE",
  포르쉐: "PORSCHE",

  TOYOTA: "TOYOTA",
  토요타: "TOYOTA",

  VOLVO: "VOLVO",
  볼보: "VOLVO",

  VOLKSWAGEN: "VW",
  VW: "VW",
  폭스바겐: "VW",

  TESLA: "TESLA",
  테슬라: "TESLA",

  "ROLLS-ROYCE": "ROLLSROYCE",
  ROLLSROYCE: "ROLLSROYCE",
  ROLLS_ROYCE: "ROLLSROYCE",
  "ROLLS ROYCE": "ROLLSROYCE",
  롤스로이스: "ROLLSROYCE",

  ASTONMARTIN: "ASTONMARTIN",
  ASTON_MARTIN: "ASTONMARTIN",
  "ASTON MARTIN": "ASTONMARTIN",
  "ASTON-MARTIN": "ASTONMARTIN",
  애스턴마틴: "ASTONMARTIN",

  MCLAREN: "MCLAREN",
  맥라렌: "MCLAREN",

  BYD: "BYD",

  INEO: "INEOS",
  INEOS: "INEOS",
  이네오스: "INEOS",

  LOTUS: "LOTUS",
  로터스: "LOTUS",

  POLESTAR: "POLESTAR",
  폴스타: "POLESTAR",
};

export function normalizeBrand(brand: string): string {
  const upper = brand.toUpperCase().trim();
  return BRAND_ALIASES[upper] ?? upper;
}

// ---------------------------------------------------------------------------
// Helper: strip common Korean noise from BNK-style verbose model names so the
// same patterns can run against both short MG names and verbose BNK names.
// ---------------------------------------------------------------------------

function stripNoise(model: string): string {
  let m = model.toUpperCase();
  // Korean engine/powertrain words
  m = m.replace(/(가솔린|디젤|전기|하이브리드|터보|MHEV|PHEV|HEV|SHEV)/g, " ");
  // Korean body style words
  m = m.replace(/(세단|해치백|왜건|쿠페|컨버터블|카브리올레|투어링|쉐보레|그란쿠페|스파이더|로드스터|카레라)/g, " ");
  // Trim noise
  m = m.replace(/\b(THE|NEW|ALL|F\/L|LCI|FIRST|EDITION|BASE|LIMITED|ROADSTER)\b/g, " ");
  // Body style markers in English
  m = m.replace(/\b4\s*DOOR\b/g, " ");
  m = m.replace(/\b2\s*DOOR\b/g, " ");
  // Engine displacement patterns like "2.0", "3.0", "4.4"
  m = m.replace(/\b\d\.\d[L]?\b/g, " ");
  // Double spaces
  return m.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// BMW patterns
// ---------------------------------------------------------------------------

function extractBmwKey(model: string): string | null {
  const m = stripNoise(model);

  // iX variants — must be checked first (iX contains "I" that could confuse other patterns)
  // "iX M60", "iX 전기 M60", "New iX 전기 M70 xDrive LCI"
  if (/\bIX\b/.test(m) || /\bIX\d/.test(m)) {
    // iX M-variant: iX M60, iX M70
    const ixM = m.match(/\bIX\b[^A-Z0-9]*.*?\bM(\d{2})\b/);
    if (ixM) return `BMW_IX_M${ixM[1]}`;

    // iX with xDrive N: iX xDrive 40/45/50/60
    const ixX = m.match(/\bIX\b[^A-Z0-9]*.*?\bX?DRIVE\s*(\d{2})\b/);
    if (ixX) return `BMW_IX${ixX[1]}`;

    // iX3 — special: "iX3 M Sport" (3-series SUV)
    if (/\bIX3\b/.test(m)) return "BMW_IX3";

    // Bare "iX"
    if (/\bIX\b/.test(m)) return "BMW_IX";
  }

  // i-series electric: i4, i5, i7
  const iSeriesMatch = m.match(/\bI([457])\b/);
  if (iSeriesMatch) return `BMW_I${iSeriesMatch[1]}`;

  // Z4 — sDrive 20i or M40i variants
  if (/\bZ4\b/.test(m)) {
    const z4Var = m.match(/\bZ4\b.*?\b(SDRIVE\s*20I|M40I)\b/);
    if (z4Var) return `BMW_Z4_${z4Var[1].replace(/\s+/g, "")}`;
    return "BMW_Z4";
  }

  // XM — X-M electric SUV
  if (/\bXM\b/.test(m)) return "BMW_XM";

  // X-series SUVs with engine designation: X1 M35i, X3 20d, X5 40d, X7 40d
  const xSeries = m.match(/\bX([1-7])\b/);
  if (xSeries) {
    const xNum = xSeries[1];
    // Look for engine designation after X-series — "M35i", "M50", "M60i", or "NN[dilseMx]"
    // Order matters: check M-performance first (M35i in X1 M35i is distinct)
    const mPerf = m.match(/\bM(\d{2}[IEDL]?)\b/);
    if (mPerf) return `BMW_X${xNum}_M${mPerf[1]}`;

    // Engine designation — support BNK "sDrive18d"/"xDrive20i" (one token) and MG "20d" (separate)
    const engWithDrive = m.match(/[XS]DRIVE(\d{2}[DIELMSX])\b/);
    if (engWithDrive) return `BMW_X${xNum}_${engWithDrive[1]}`;
    const eng = m.match(/\b(\d{2}[DIELMSX])\b/);
    if (eng) return `BMW_X${xNum}_${eng[1]}`;

    return `BMW_X${xNum}`;
  }

  // M-performance 3-digit variants: M135i, M235i, M240i, M340i, M440i, M550i, M760Li, M850i
  // Note: optional Li (long + injection), optional trailing I
  const mPerf3 = m.match(/\bM\s*(\d{3})(L?I?)\b/);
  if (mPerf3) {
    const suffix = mPerf3[2] || "";
    return `BMW_M${mPerf3[1]}${suffix}`;
  }

  // Full M-cars: M2, M3, M4, M5, M8 (single digit)
  const mCar = m.match(/\bM([2-8])\b/);
  if (mCar) return `BMW_M${mCar[1]}`;

  // Standalone M-prefix 2-digit variants (MG lists these without series prefix):
  // "M35i xDrive" (X1/X2 M35i), "M50 xDrive" (i4/iX3 M50), "M60i" (X5/X7 M60i or iX M60)
  // Ambiguous without context — produces a best-effort key
  const mStandalone = m.match(/\bM(\d{2})([IEDL]?)\b/);
  if (mStandalone) return `BMW_M${mStandalone[1]}${mStandalone[2]}`;

  // Standard 3-digit with letter suffix: 320d, 520i, 330e, 550e, 740i, 840i, 118d, 220i, 120I
  const std = m.match(/\b(\d{3})([DIELSXM])\b/);
  if (std) return `BMW_${std[1]}${std[2]}`;

  // 3-digit WITHOUT trailing letter: "120 base", "120 M Sport" (bare 120)
  const bareNum = m.match(/\b(\d{3})\b/);
  if (bareNum) return `BMW_${bareNum[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// BENZ / MERCEDES-BENZ patterns
// ---------------------------------------------------------------------------

function extractBenzKey(model: string): string | null {
  const m = stripNoise(model);

  // AMG GT series — "AMG GT 43", "AMG GT 55", "AMG GT 63"
  // Must match AFTER stripping "4door" noise (handled in stripNoise)
  const gtMatch = m.match(/\bGT\s*(\d{2,3})\b/);
  if (gtMatch) return `BENZ_GT${gtMatch[1]}`;

  // EQ models: EQA, EQB, EQC, EQE, EQS — REQUIRE the 3-digit number first (BNK duplicates "EQA 전기 EQA 250")
  const eqWithNum = m.match(/\bEQ([ABCES])\s*\+?\s*(\d{3})\b/);
  if (eqWithNum) return `BENZ_EQ${eqWithNum[1]}${eqWithNum[2]}`;
  // Bare EQ without number (fallback)
  const eqBare = m.match(/\bEQ([ABCES])\b/);
  if (eqBare) return `BENZ_EQ${eqBare[1]}`;

  // Multi-letter class + digits: CLE53, CLA250, CLS450, GLC300, GLE350, GLS580, GLB250
  const multiMatch = m.match(/\b(CL[AES]|GL[ABCES]|SL[CK]?)\s*(\d{2,3})/);
  if (multiMatch) {
    const cls = multiMatch[1].replace(/\s+/g, "");
    return `BENZ_${cls}${multiMatch[2]}`;
  }

  // G-Class: G63 AMG, G450d — 2 or 3 digit with optional suffix letter (no space between G and digits in BNK)
  const gClass = m.match(/\bG\s*(\d{2,3})([DEL])?\b/);
  if (gClass) {
    const suffix = gClass[2] || "";
    return `BENZ_G${gClass[1]}${suffix}`;
  }

  // "A 35 AMG", "A 45 AMG" — single letter + 2-digit AMG variant
  const amgShort = m.match(/\b([ABCES])\s*(\d{2})\b/);
  if (amgShort && /AMG/.test(m)) {
    return `BENZ_${amgShort[1]}${amgShort[2]}AMG`;
  }

  // Single-letter class + 3 digits + optional letter: E220D, A200D, S500, C300D, A220
  const singleMatch = m.match(/\b([ABCES])\s*(\d{3})\s*([DEIL])?\b/);
  if (singleMatch) {
    const letter = singleMatch[3] || "";
    return `BENZ_${singleMatch[1]}${singleMatch[2]}${letter}`;
  }

  // Maybach, V-Class
  if (/\bMAYBACH\b/.test(m)) return "BENZ_MAYBACH";
  const vClass = m.match(/\bV\s*(\d{3})\b/);
  if (vClass) return `BENZ_V${vClass[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// AUDI patterns
// ---------------------------------------------------------------------------

function extractAudiKey(model: string): string | null {
  const m = stripNoise(model);

  // e-tron variants: "e-tron GT", "Q4 e-tron", "Q8 e-tron", "e-tron S", "SQ8 e-tron"
  const etronMatch = m.match(/\b(S?Q[48])?\s*E-?TRON\s*(GT|S)?\b/);
  if (etronMatch) {
    const prefix = etronMatch[1] || "";
    const suffix = etronMatch[2] || "";
    const key = [prefix, "ETRON", suffix].filter(Boolean).join("_");
    return `AUDI_${key}`;
  }

  // RS Q8, RS Q3
  const rsqMatch = m.match(/\bRS\s*Q\s*(\d)\b/);
  if (rsqMatch) return `AUDI_RSQ${rsqMatch[1]}`;

  // RS models: RS3, RS4, RS5, RS6, RS7 — allow space "RS 6 Avant"
  const rsMatch = m.match(/\bRS\s*(\d)\b/);
  if (rsMatch) return `AUDI_RS${rsMatch[1]}`;

  // SQ models: SQ5, SQ7, SQ8
  const sqMatch = m.match(/\bSQ\s*(\d)\b/);
  if (sqMatch) return `AUDI_SQ${sqMatch[1]}`;

  // S models: S3, S4, S5, S6, S7, S8 — allow space "S 4 TFSI"
  const sMatch = m.match(/\bS\s*(\d)\b/);
  if (sMatch) return `AUDI_S${sMatch[1]}`;

  // TT and R8
  if (/\bTT\b/.test(m)) return "AUDI_TT";
  if (/\bR8\b/.test(m)) return "AUDI_R8";

  // Standard model lines: A1-A8, Q2-Q8
  const stdMatch = m.match(/\b([AQ])(\d)\b/);
  if (stdMatch) return `AUDI_${stdMatch[1]}${stdMatch[2]}`;

  return null;
}

// ---------------------------------------------------------------------------
// VOLVO patterns
// ---------------------------------------------------------------------------

function extractVolvoKey(model: string): string | null {
  const m = stripNoise(model);

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
  const m = stripNoise(model);

  // LBX (no numbers)
  if (/\bLBX\b/.test(m)) return "LEXUS_LBX";

  // Special F-performance models: RC F, GS F, IS F (letter F, not "F Sport" trim)
  if (/\bRC\s+F\b/.test(m)) return "LEXUS_RCF";
  if (/\bGS\s+F\b/.test(m)) return "LEXUS_GSF";
  if (/\bIS\s+F\b/.test(m)) return "LEXUS_ISF";

  // LC Convertible 500 — body style between class and number
  const lcConv = m.match(/\bLC\s+CONVERTIBLE\s+(\d{3})([HE])?\b/);
  if (lcConv) {
    const suffix = lcConv[2] || "";
    return `LEXUS_LC${lcConv[1]}${suffix}_CONV`;
  }

  // Models: RX350H, ES300H, NX350H, IS300H, LS500H, LC500, UX300E, LM500H
  const lexMatch = m.match(/\b([A-Z]{2,3})\s*(\d{3})([HE])?\b/);
  if (lexMatch) {
    const suffix = lexMatch[3] || "";
    return `LEXUS_${lexMatch[1]}${lexMatch[2]}${suffix}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// GENESIS / HYUNDAI / KIA patterns
// ---------------------------------------------------------------------------

function extractGenesisKey(model: string): string | null {
  const m = stripNoise(model);
  // GV60, GV70, GV80, G70, G80, G90
  const stdMatch = m.match(/\b(GV|G)(\d{2})\b/);
  if (stdMatch) return `GENESIS_${stdMatch[1]}${stdMatch[2]}`;
  return null;
}

// ---------------------------------------------------------------------------
// PORSCHE patterns — model lines with variant suffix
// 911, 718 (Boxster/Cayman), Cayenne, Macan, Panamera, Taycan
// ---------------------------------------------------------------------------

function extractPorscheKey(model: string): string | null {
  const m = stripNoise(model);

  // 911 variants — Carrera/Turbo/GT3/Targa + optional S/4/GTS
  if (/\b911\b/.test(m)) {
    // Priority: GT3 RS > GT3 > Turbo S > Turbo > Carrera 4 GTS > Carrera GTS > Carrera 4S > Carrera S > Carrera 4 > Carrera > Targa
    if (/\bGT3\s*RS\b/.test(m)) return "PORSCHE_911_GT3RS";
    if (/\bGT3\b/.test(m)) return "PORSCHE_911_GT3";
    if (/\bTURBO\s*S\b/.test(m)) return "PORSCHE_911_TURBOS";
    if (/\bTURBO\b/.test(m)) return "PORSCHE_911_TURBO";
    if (/\bCARRERA\s*4\s*GTS\b/.test(m)) return "PORSCHE_911_CARRERA4GTS";
    if (/\bCARRERA\s*GTS\b/.test(m)) return "PORSCHE_911_CARRERAGTS";
    if (/\bCARRERA\s*4S\b/.test(m)) return "PORSCHE_911_CARRERA4S";
    if (/\bCARRERA\s*S\b/.test(m)) return "PORSCHE_911_CARRERAS";
    if (/\bCARRERA\s*4\b/.test(m)) return "PORSCHE_911_CARRERA4";
    if (/\bCARRERA\b/.test(m)) return "PORSCHE_911_CARRERA";
    if (/\bTARGA\b/.test(m)) return "PORSCHE_911_TARGA";
    return "PORSCHE_911";
  }

  // 718 Cayman / Boxster
  if (/\b718\b/.test(m)) {
    if (/\bCAYMAN\b/.test(m)) return "PORSCHE_718_CAYMAN";
    if (/\bBOXSTER\b/.test(m)) return "PORSCHE_718_BOXSTER";
    return "PORSCHE_718";
  }

  // Cayenne variants — base/S/Turbo/Coupe/E-Hybrid
  if (/\bCAYENNE\b/.test(m)) {
    const coupe = /\bCOUPE\b/.test(m) ? "_COUPE" : "";
    if (/\bTURBO\s*GT\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_TURBOGT`;
    if (/\bTURBO\s*S\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_TURBOS`;
    if (/\bTURBO\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_TURBO`;
    if (/\bE-?HYBRID\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_EHYBRID`;
    if (/\bGTS\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_GTS`;
    if (/\bS\b/.test(m)) return `PORSCHE_CAYENNE${coupe}_S`;
    return `PORSCHE_CAYENNE${coupe}`;
  }

  // Macan variants
  if (/\bMACAN\b/.test(m)) {
    if (/\bTURBO\b/.test(m)) return "PORSCHE_MACAN_TURBO";
    if (/\bGTS\b/.test(m)) return "PORSCHE_MACAN_GTS";
    if (/\bS\b/.test(m)) return "PORSCHE_MACAN_S";
    return "PORSCHE_MACAN";
  }

  // Panamera variants
  if (/\bPANAMERA\b/.test(m)) {
    if (/\bTURBO\s*S\b/.test(m)) return "PORSCHE_PANAMERA_TURBOS";
    if (/\bTURBO\b/.test(m)) return "PORSCHE_PANAMERA_TURBO";
    if (/\bGTS\b/.test(m)) return "PORSCHE_PANAMERA_GTS";
    if (/\b4S\b/.test(m)) return "PORSCHE_PANAMERA_4S";
    if (/\bE-?HYBRID\b/.test(m)) return "PORSCHE_PANAMERA_EHYBRID";
    return "PORSCHE_PANAMERA";
  }

  // Taycan variants
  if (/\bTAYCAN\b/.test(m)) {
    if (/\bTURBO\s*S\b/.test(m)) return "PORSCHE_TAYCAN_TURBOS";
    if (/\bTURBO\b/.test(m)) return "PORSCHE_TAYCAN_TURBO";
    if (/\bGTS\b/.test(m)) return "PORSCHE_TAYCAN_GTS";
    if (/\b4S\b/.test(m)) return "PORSCHE_TAYCAN_4S";
    if (/\bCROSS\s*TURISMO\b/.test(m)) return "PORSCHE_TAYCAN_CROSS";
    return "PORSCHE_TAYCAN";
  }

  return null;
}

// ---------------------------------------------------------------------------
// MINI patterns — model lines: Cooper, Clubman, Countryman, Aceman, John Cooper
// ---------------------------------------------------------------------------

function extractMiniKey(model: string): string | null {
  const m = stripNoise(model);

  const lineMatch = m.match(/\b(COUNTRYMAN|CLUBMAN|CONVERTIBLE|HATCH|ACEMAN|JCW|COOPER)\b/);
  if (!lineMatch) return null;
  const line = lineMatch[1];

  // Variant: JCW > Cooper SD > Cooper S > Cooper D > Cooper SE > Cooper E > Cooper
  let variant = "";
  if (/\bJCW\b|\bJOHN\s*COOPER\s*WORKS\b/.test(m)) variant = "_JCW";
  else if (/\bSE\b/.test(m)) variant = "_COOPER_SE";
  else if (/\bSD\b/.test(m)) variant = "_COOPER_SD";
  else if (/\bS\s*E\b/.test(m)) variant = "_COOPER_S";
  else if (/\bCOOPER\s*D\b/.test(m)) variant = "_COOPER_D";
  else if (/\bCOOPER\s*S\b/.test(m)) variant = "_COOPER_S";
  else if (/\bCOOPER\s*C\b/.test(m)) variant = "_COOPER_C";
  else if (/\bCOOPER\b/.test(m)) variant = "_COOPER";

  if (line === "COOPER") {
    // Bare COOPER as line — check if it's actually part of a longer name
    return variant ? `MINI${variant}` : "MINI_COOPER";
  }
  return `MINI_${line}${variant}`;
}

// ---------------------------------------------------------------------------
// Jeep patterns — Wrangler, Grand Cherokee, Cherokee, Compass, Renegade, Avenger, Gladiator
// ---------------------------------------------------------------------------

function extractJeepKey(model: string): string | null {
  const m = stripNoise(model);
  const lineMatch = m.match(/\b(WRANGLER|GRAND\s*CHEROKEE|CHEROKEE|COMPASS|RENEGADE|AVENGER|GLADIATOR)\b/);
  if (!lineMatch) return null;
  const line = lineMatch[1].replace(/\s+/g, "");
  return `JEEP_${line}`;
}

// ---------------------------------------------------------------------------
// Volkswagen patterns — Golf, Jetta, Arteon, Atlas, Tiguan, Passat, Polo, ID.4, ID.7
// ---------------------------------------------------------------------------

function extractVwKey(model: string): string | null {
  const m = stripNoise(model);
  // ID models
  const idMatch = m.match(/\bID\.?\s*(\d)\b/);
  if (idMatch) return `VW_ID${idMatch[1]}`;

  const lineMatch = m.match(/\b(GOLF|JETTA|ARTEON|ATLAS|TIGUAN|PASSAT|POLO|TAYRON|TOUAREG|T-ROC|T-CROSS)\b/);
  if (!lineMatch) return null;
  const line = lineMatch[1].replace(/\s+/g, "").replace(/-/g, "");
  // Variant: GTI / R / TDI / TSI
  if (/\bGTI\b/.test(m)) return `VW_${line}_GTI`;
  if (/\bGOLF.*\bR\b/.test(m)) return `VW_${line}_R`;
  if (/\bTDI\b/.test(m)) return `VW_${line}_TDI`;
  return `VW_${line}`;
}

// ---------------------------------------------------------------------------
// Maserati patterns — Ghibli, Grecale, GranTurismo, Grancabrio, Levante, Quattroporte, MC20
// ---------------------------------------------------------------------------

function extractMaseratiKey(model: string): string | null {
  const m = stripNoise(model);
  if (/\bMC20\b/.test(m)) return "MASERATI_MC20";
  const lineMatch = m.match(/\b(GHIBLI|GRECALE|GRANTURISMO|GRANCABRIO|LEVANTE|QUATTROPORTE)\b/);
  if (!lineMatch) return null;
  const line = lineMatch[1];
  if (/\bTROFEO\b/.test(m)) return `MASERATI_${line}_TROFEO`;
  if (/\bMODENA\b/.test(m)) return `MASERATI_${line}_MODENA`;
  if (/\bFOLGORE\b/.test(m)) return `MASERATI_${line}_FOLGORE`;
  if (/\bGT\b/.test(m)) return `MASERATI_${line}_GT`;
  return `MASERATI_${line}`;
}

// ---------------------------------------------------------------------------
// Peugeot patterns — 208, 308, 408, 508, 2008, 3008, 5008, 2008 e, e-208, e-2008
// ---------------------------------------------------------------------------

function extractPeugeotKey(model: string): string | null {
  const m = stripNoise(model);
  // e-NNN or e-NNNN (electric variants)
  const eMatch = m.match(/\bE-?\s*(\d{3,4})\b/);
  if (eMatch) return `PEUGEOT_E${eMatch[1]}`;
  // Standard 3-4 digit
  const stdMatch = m.match(/\b(\d{3,4})\b/);
  if (stdMatch) return `PEUGEOT_${stdMatch[1]}`;
  return null;
}

// ---------------------------------------------------------------------------
// Toyota patterns — Crown, Prius, RAV4, Camry, Alphard, Highlander, Sienna, GR86, Supra
// ---------------------------------------------------------------------------

function extractToyotaKey(model: string): string | null {
  const m = stripNoise(model);
  if (/\bGR\s*86\b/.test(m)) return "TOYOTA_GR86";
  if (/\bGR\s*SUPRA\b/.test(m)) return "TOYOTA_SUPRA";
  const lineMatch = m.match(/\b(CROWN|PRIUS|RAV4|CAMRY|ALPHARD|HIGHLANDER|SIENNA|SUPRA|CENTURY|LANDCRUISER)\b/);
  if (!lineMatch) return null;
  return `TOYOTA_${lineMatch[1].replace(/\s+/g, "")}`;
}

// ---------------------------------------------------------------------------
// Cadillac patterns — CT4/CT5, XT4/XT5/XT6, Escalade, Lyriq
// ---------------------------------------------------------------------------

function extractCadillacKey(model: string): string | null {
  const m = stripNoise(model);
  const ctxt = m.match(/\b([CX]T\d)\b/);
  if (ctxt) return `CADILLAC_${ctxt[1]}`;
  if (/\bESCALADE\s*IQ\b/.test(m)) return "CADILLAC_ESCALADEIQ";
  if (/\bESCALADE\b/.test(m)) return "CADILLAC_ESCALADE";
  if (/\bLYRIQ\b/.test(m)) return "CADILLAC_LYRIQ";
  return null;
}

// ---------------------------------------------------------------------------
// Ford patterns — Explorer, Bronco, Expedition, Mustang, F-150, Ranger, Edge, Escape
// ---------------------------------------------------------------------------

function extractFordKey(model: string): string | null {
  const m = stripNoise(model);
  const lineMatch = m.match(/\b(EXPLORER|BRONCO|EXPEDITION|MUSTANG|F-?150|RANGER|EDGE|ESCAPE|ECOSPORT|FUSION|FOCUS)\b/);
  if (!lineMatch) return null;
  return `FORD_${lineMatch[1].replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// Lincoln patterns — Navigator, Aviator, Nautilus, Corsair, Continental, MKX/MKZ
// ---------------------------------------------------------------------------

function extractLincolnKey(model: string): string | null {
  const m = stripNoise(model);
  const lineMatch = m.match(/\b(NAUTILUS|CORSAIR|NAVIGATOR|AVIATOR|CONTINENTAL|MK[A-Z])\b/);
  if (!lineMatch) return null;
  return `LINCOLN_${lineMatch[1]}`;
}

// ---------------------------------------------------------------------------
// Honda patterns — Accord, Civic, CR-V, Odyssey, Pilot, Passport
// ---------------------------------------------------------------------------

function extractHondaKey(model: string): string | null {
  const m = stripNoise(model);
  const lineMatch = m.match(/\b(ACCORD|CIVIC|CR-?V|ODYSSEY|PILOT|PASSPORT|RIDGELINE)\b/);
  if (!lineMatch) return null;
  return `HONDA_${lineMatch[1].replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// Lamborghini — Urus, Huracan, Aventador, Revuelto, Temerario
// ---------------------------------------------------------------------------

function extractLamborghiniKey(model: string): string | null {
  const m = stripNoise(model);
  const lineMatch = m.match(/\b(URUS|HURACAN|AVENTADOR|REVUELTO|TEMERARIO)\b/);
  if (!lineMatch) return null;
  return `LAMBO_${lineMatch[1]}`;
}

// ---------------------------------------------------------------------------
// Bentley — Continental (GT/GTC/Flying Spur), Bentayga, Mulsanne
// ---------------------------------------------------------------------------

function extractBentleyKey(model: string): string | null {
  const m = stripNoise(model);
  if (/\bFLYING\s*SPUR\b/.test(m)) return "BENTLEY_FLYINGSPUR";
  if (/\bCONTINENTAL\s*GTC\b/.test(m)) return "BENTLEY_CONTINENTAL_GTC";
  if (/\bCONTINENTAL\s*GT\b/.test(m)) return "BENTLEY_CONTINENTAL_GT";
  if (/\bCONTINENTAL\b/.test(m)) return "BENTLEY_CONTINENTAL";
  if (/\bBENTAYGA\b/.test(m)) return "BENTLEY_BENTAYGA";
  if (/\bMULSANNE\b/.test(m)) return "BENTLEY_MULSANNE";
  return null;
}

// ---------------------------------------------------------------------------
// Ferrari — model names are the designation itself
// ---------------------------------------------------------------------------

function extractFerrariKey(model: string): string | null {
  const m = stripNoise(model);
  // Famous models: Portofino, Roma, F8, 296, 812, SF90, Purosangue, 12Cilindri, Amalfi
  const lineMatch = m.match(/\b(PORTOFINO|ROMA|F8|296|812|SF90|PUROSANGUE|12CILINDRI|AMALFI|GTC4|LAFERRARI)\b/);
  if (!lineMatch) return null;
  return `FERRARI_${lineMatch[1]}`;
}

// ---------------------------------------------------------------------------
// Landrover / Jaguar — Defender, Range Rover (Sport/Velar/Evoque), Discovery, F-Pace, I-Pace, XF, F-Type
// ---------------------------------------------------------------------------

function extractLandroverKey(model: string): string | null {
  const m = stripNoise(model);
  if (/\bRANGE\s*ROVER\s*SPORT\b/.test(m)) return "LR_RRSPORT";
  if (/\bRANGE\s*ROVER\s*VELAR\b/.test(m)) return "LR_RRVELAR";
  if (/\bRANGE\s*ROVER\s*EVOQUE\b/.test(m)) return "LR_RREVOQUE";
  if (/\bRANGE\s*ROVER\b/.test(m)) return "LR_RANGEROVER";
  if (/\bDEFENDER\b/.test(m)) return "LR_DEFENDER";
  if (/\bDISCOVERY\s*SPORT\b/.test(m)) return "LR_DISCOVERYSPORT";
  if (/\bDISCOVERY\b/.test(m)) return "LR_DISCOVERY";
  // Jaguar
  if (/\bF-?PACE\b/.test(m)) return "LR_FPACE";
  if (/\bI-?PACE\b/.test(m)) return "LR_IPACE";
  if (/\bE-?PACE\b/.test(m)) return "LR_EPACE";
  if (/\bF-?TYPE\b/.test(m)) return "LR_FTYPE";
  if (/\bXE\b/.test(m)) return "LR_XE";
  if (/\bXF\b/.test(m)) return "LR_XF";
  if (/\bXJ\b/.test(m)) return "LR_XJ";
  return null;
}

// ---------------------------------------------------------------------------
// Generic fallback — take first alphanumeric token as the key
// ---------------------------------------------------------------------------

function extractGenericKey(brand: string, model: string): string | null {
  const cleaned = stripNoise(model);
  const firstToken = cleaned.match(/\b([A-Z0-9][A-Z0-9-]{1,})\b/);
  if (!firstToken) return null;
  return `${brand.toUpperCase()}_${firstToken[1].replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a normalized vehicle key from a lender-specific model name.
 *
 * @returns e.g. "BMW_520I", "BENZ_E220D", "PORSCHE_911_CARRERA", or null if
 *          no pattern matched.
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
    case "PORSCHE":
      return extractPorscheKey(modelName);
    case "MINI":
      return extractMiniKey(modelName);
    case "JEEP":
      return extractJeepKey(modelName);
    case "VW":
      return extractVwKey(modelName);
    case "MASERATI":
      return extractMaseratiKey(modelName);
    case "PEUGEOT":
      return extractPeugeotKey(modelName);
    case "TOYOTA":
      return extractToyotaKey(modelName);
    case "CADILLAC":
      return extractCadillacKey(modelName);
    case "FORD":
      return extractFordKey(modelName);
    case "LINCOLN":
      return extractLincolnKey(modelName);
    case "HONDA":
      return extractHondaKey(modelName);
    case "LAMBORGHINI":
      return extractLamborghiniKey(modelName);
    case "BENTLEY":
      return extractBentleyKey(modelName);
    case "FERRARI":
      return extractFerrariKey(modelName);
    case "LANDROVER":
      return extractLandroverKey(modelName);
    case "HYUNDAI":
    case "KIA":
      return extractGenericKey(b, modelName);
    default:
      return extractGenericKey(b, modelName);
  }
}

/**
 * Given an array of candidate vehicles, find the one whose vehicleKey matches
 * the requested model's vehicleKey. Brand-agnostic: works across lenders using
 * different brand name spellings (e.g., MG "AUDI" vs BNK "아우디").
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

  const requestedBrand = normalizeBrand(brand);

  for (const candidate of candidates) {
    if (normalizeBrand(candidate.brand) !== requestedBrand) continue;
    const candidateKey = extractVehicleKey(candidate.brand, candidate.modelName);
    if (candidateKey === requestedKey) return candidate;
  }

  return null;
}

/**
 * Return all known brand name spellings that map to the same canonical brand.
 * Used by engine fallback queries to search across both MG (English) and
 * BNK (Korean) brand strings.
 */
export function resolveBrandAliases(brand: string): string[] {
  const canonical = normalizeBrand(brand);
  const aliases = Object.entries(BRAND_ALIASES)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k);
  return aliases.length > 0 ? aliases : [brand.toUpperCase()];
}
