import { expect, test } from "bun:test";
import {
  extractVehicleKey,
  resolveModelNameByVehicleKey,
} from "@/domain/vehicles/vehicle-key";

// ---------------------------------------------------------------------------
// BMW
// ---------------------------------------------------------------------------

test("BMW MG: 520i → BMW_520I", () => {
  expect(extractVehicleKey("BMW", "520i")).toBe("BMW_520I");
});

test("BMW BNK: The New 5 Series 가솔린 2.0 520i → BMW_520I", () => {
  expect(extractVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i")).toBe("BMW_520I");
});

test("BMW MG: 320d Sedan → BMW_320D", () => {
  expect(extractVehicleKey("BMW", "320d Sedan")).toBe("BMW_320D");
});

test("BMW BNK: The New 3 Series 디젤 2.0 320d → BMW_320D", () => {
  expect(extractVehicleKey("BMW", "The New 3 Series 디젤 2.0 320d")).toBe("BMW_320D");
});

test("BMW MG: X7 xDrive 40d DPE (6인승) → BMW_X7_40D", () => {
  expect(extractVehicleKey("BMW", "X7 xDrive 40d DPE (6인승)")).toBe("BMW_X7_40D");
});

test("BMW BNK: The New X7 디젤 3.0 40d → BMW_X7_40D", () => {
  expect(extractVehicleKey("BMW", "The New X7 디젤 3.0 40d")).toBe("BMW_X7_40D");
});

test("BMW MG: X5 xDrive 30d M Sport → BMW_X5_30D", () => {
  expect(extractVehicleKey("BMW", "X5 xDrive 30d M Sport")).toBe("BMW_X5_30D");
});

test("BMW MG: X5 30d M Sport xDrive (5인승) → BMW_X5_30D", () => {
  expect(extractVehicleKey("BMW", "X5 30d M Sport xDrive (5인승)")).toBe("BMW_X5_30D");
});

test("BMW MG: X3 xDrive 20d M Sport → BMW_X3_20D", () => {
  expect(extractVehicleKey("BMW", "X3 xDrive 20d M Sport")).toBe("BMW_X3_20D");
});

test("BMW MG: X3 20d xDrive → BMW_X3_20D", () => {
  expect(extractVehicleKey("BMW", "X3 20d xDrive")).toBe("BMW_X3_20D");
});

test("BMW X1 sDrive18i → BMW_X1_18I", () => {
  expect(extractVehicleKey("BMW", "X1 sDrive18i")).toBe("BMW_X1_18I");
});

test("BMW iX models → BMW_IX40, BMW_IX50", () => {
  expect(extractVehicleKey("BMW", "iX xDrive40")).toBe("BMW_IX40");
  expect(extractVehicleKey("BMW", "iX xDrive50")).toBe("BMW_IX50");
});

test("BMW i-series → BMW_I4, BMW_I5, BMW_I7", () => {
  expect(extractVehicleKey("BMW", "i4 eDrive40")).toBe("BMW_I4");
  expect(extractVehicleKey("BMW", "i5 M60 xDrive")).toBe("BMW_I5");
  expect(extractVehicleKey("BMW", "i7 xDrive60")).toBe("BMW_I7");
});

test("BMW M-cars → BMW_M3, BMW_M4", () => {
  expect(extractVehicleKey("BMW", "M3 Competition")).toBe("BMW_M3");
  expect(extractVehicleKey("BMW", "M4 Competition")).toBe("BMW_M4");
});

test("BMW XM → BMW_XM", () => {
  expect(extractVehicleKey("BMW", "XM Label Red")).toBe("BMW_XM");
});

// ---------------------------------------------------------------------------
// BENZ / MERCEDES-BENZ
// ---------------------------------------------------------------------------

test("BENZ MG: E 220d 4Matic Exclusive → BENZ_E220D", () => {
  expect(extractVehicleKey("BENZ", "E 220d 4Matic Exclusive")).toBe("BENZ_E220D");
});

test("BENZ MG: E 220d 4MATIC Exclusive → BENZ_E220D", () => {
  expect(extractVehicleKey("BENZ", "E 220d 4MATIC Exclusive")).toBe("BENZ_E220D");
});

test("BENZ MG: A 200d Sedan → BENZ_A200D", () => {
  expect(extractVehicleKey("BENZ", "A 200d Sedan")).toBe("BENZ_A200D");
});

test("BENZ BNK: CLE 53 AMG long name → BENZ_CLE53", () => {
  expect(
    extractVehicleKey("BENZ", "The All New CLE 가솔린 3.0 AMG 카브리올레 CLE 53 AMG 4Matic+"),
  ).toBe("BENZ_CLE53");
});

test("BENZ GLC 300 4Matic → BENZ_GLC300", () => {
  expect(extractVehicleKey("BENZ", "GLC 300 4Matic")).toBe("BENZ_GLC300");
});

test("BENZ GLE 350d 4Matic → BENZ_GLE350", () => {
  expect(extractVehicleKey("BENZ", "GLE 350d 4Matic")).toBe("BENZ_GLE350");
});

test("BENZ S 500 4Matic → BENZ_S500", () => {
  expect(extractVehicleKey("BENZ", "S 500 4Matic")).toBe("BENZ_S500");
});

test("BENZ C 300d AMG Line → BENZ_C300D", () => {
  expect(extractVehicleKey("BENZ", "C 300d AMG Line")).toBe("BENZ_C300D");
});

test("BENZ EQE 350+ → BENZ_EQE350", () => {
  expect(extractVehicleKey("BENZ", "EQE 350+")).toBe("BENZ_EQE350");
});

test("BENZ EQS 450+ → BENZ_EQS450", () => {
  expect(extractVehicleKey("BENZ", "EQS 450+")).toBe("BENZ_EQS450");
});

test("MERCEDES-BENZ alias → BENZ key prefix", () => {
  expect(extractVehicleKey("MERCEDES-BENZ", "E 220d 4Matic Exclusive")).toBe("BENZ_E220D");
});

// ---------------------------------------------------------------------------
// AUDI
// ---------------------------------------------------------------------------

test("AUDI MG: A3 40 TFSI Premium → AUDI_A3", () => {
  expect(extractVehicleKey("AUDI", "A3 40 TFSI Premium")).toBe("AUDI_A3");
});

test("AUDI BNK: The New A7 디젤 3.0 50 TDI Quattro Premium → AUDI_A7", () => {
  expect(extractVehicleKey("AUDI", "The New A7 디젤 3.0 50 TDI Quattro Premium")).toBe("AUDI_A7");
});

test("AUDI Q5 45 TFSI Quattro → AUDI_Q5", () => {
  expect(extractVehicleKey("AUDI", "Q5 45 TFSI Quattro")).toBe("AUDI_Q5");
});

test("AUDI Q8 55 TFSI Quattro → AUDI_Q8", () => {
  expect(extractVehicleKey("AUDI", "Q8 55 TFSI Quattro")).toBe("AUDI_Q8");
});

test("AUDI e-tron GT → AUDI_ETRON_GT", () => {
  expect(extractVehicleKey("AUDI", "e-tron GT")).toBe("AUDI_ETRON_GT");
});

test("AUDI Q4 e-tron → AUDI_Q4_ETRON", () => {
  expect(extractVehicleKey("AUDI", "Q4 e-tron 40")).toBe("AUDI_Q4_ETRON");
});

test("AUDI RS models → AUDI_RS6", () => {
  expect(extractVehicleKey("AUDI", "RS 6 Avant")).toBe("AUDI_RS6");
});

test("AUDI S models → AUDI_S3", () => {
  expect(extractVehicleKey("AUDI", "S3 Sportback")).toBe("AUDI_S3");
});

test("AUDI TT → AUDI_TT", () => {
  expect(extractVehicleKey("AUDI", "TT RS Coupe")).toBe("AUDI_TT");
});

test("AUDI R8 → AUDI_R8", () => {
  expect(extractVehicleKey("AUDI", "R8 V10 Performance")).toBe("AUDI_R8");
});

// ---------------------------------------------------------------------------
// VOLVO
// ---------------------------------------------------------------------------

test("VOLVO MG: XC40 B4 AWD Ultra Dark → VOLVO_XC40", () => {
  expect(extractVehicleKey("VOLVO", "XC40 B4 AWD Ultra Dark")).toBe("VOLVO_XC40");
});

test("VOLVO BNK: The New XC40 가솔린 2.0 MHEV B4 Plus Bright AWD → VOLVO_XC40", () => {
  expect(extractVehicleKey("VOLVO", "The New XC40 가솔린 2.0 MHEV B4 Plus Bright AWD")).toBe("VOLVO_XC40");
});

test("VOLVO XC60, XC90, S60, S90, V60, V90 → correct keys", () => {
  expect(extractVehicleKey("VOLVO", "XC60 B5 AWD")).toBe("VOLVO_XC60");
  expect(extractVehicleKey("VOLVO", "XC90 B6 AWD")).toBe("VOLVO_XC90");
  expect(extractVehicleKey("VOLVO", "S60 B5")).toBe("VOLVO_S60");
  expect(extractVehicleKey("VOLVO", "S90 B6 AWD")).toBe("VOLVO_S90");
  expect(extractVehicleKey("VOLVO", "V60 B5")).toBe("VOLVO_V60");
  expect(extractVehicleKey("VOLVO", "V90 Cross Country")).toBe("VOLVO_V90");
});

test("VOLVO EX30, EX90, C40 → electric models", () => {
  expect(extractVehicleKey("VOLVO", "EX30 Single Motor")).toBe("VOLVO_EX30");
  expect(extractVehicleKey("VOLVO", "EX90 Twin Motor")).toBe("VOLVO_EX90");
  expect(extractVehicleKey("VOLVO", "C40 Recharge")).toBe("VOLVO_C40");
});

// ---------------------------------------------------------------------------
// LEXUS
// ---------------------------------------------------------------------------

test("LEXUS MG: RX 350h → LEXUS_RX350H", () => {
  expect(extractVehicleKey("LEXUS", "RX 350h")).toBe("LEXUS_RX350H");
});

test("LEXUS ES 300h → LEXUS_ES300H", () => {
  expect(extractVehicleKey("LEXUS", "ES 300h")).toBe("LEXUS_ES300H");
});

test("LEXUS NX 350h → LEXUS_NX350H", () => {
  expect(extractVehicleKey("LEXUS", "NX 350h")).toBe("LEXUS_NX350H");
});

test("LEXUS LBX → LEXUS_LBX", () => {
  expect(extractVehicleKey("LEXUS", "LBX")).toBe("LEXUS_LBX");
});

// ---------------------------------------------------------------------------
// GENESIS
// ---------------------------------------------------------------------------

test("GENESIS G80 → GENESIS_G80", () => {
  expect(extractVehicleKey("GENESIS", "G80 2.5T")).toBe("GENESIS_G80");
});

test("GENESIS GV70 → GENESIS_GV70", () => {
  expect(extractVehicleKey("GENESIS", "GV70 2.5T Sport")).toBe("GENESIS_GV70");
});

test("GENESIS GV80 → GENESIS_GV80", () => {
  expect(extractVehicleKey("GENESIS", "GV80 3.5T")).toBe("GENESIS_GV80");
});

// ---------------------------------------------------------------------------
// Generic / Edge cases
// ---------------------------------------------------------------------------

test("HYUNDAI → generic key from first token", () => {
  expect(extractVehicleKey("HYUNDAI", "IONIQ 5 Long Range")).toBe("HYUNDAI_IONIQ");
});

test("KIA → generic key from first token", () => {
  expect(extractVehicleKey("KIA", "EV6 GT-Line")).toBe("KIA_EV6");
});

test("PORSCHE 911 Carrera → PORSCHE_911_CARRERA", () => {
  expect(extractVehicleKey("PORSCHE", "911 Carrera")).toBe("PORSCHE_911_CARRERA");
});

test("truly unknown brand falls back to generic key", () => {
  const k = extractVehicleKey("ZZZ_NONEXISTENT", "Model X");
  expect(k).toBe("ZZZ_NONEXISTENT_MODEL");
});

// ---------------------------------------------------------------------------
// Cross-lender parity — same car, different naming
// ---------------------------------------------------------------------------

test("parity: BMW 520i MG vs BNK → same key", () => {
  const mgKey = extractVehicleKey("BMW", "520i");
  const bnkKey = extractVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("BMW_520I");
});

test("parity: BMW 320d MG vs BNK → same key", () => {
  const mgKey = extractVehicleKey("BMW", "320d Sedan");
  const bnkKey = extractVehicleKey("BMW", "The New 3 Series 디젤 2.0 320d");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("BMW_320D");
});

test("parity: BMW X7 40d MG vs BNK → same key", () => {
  const mgKey = extractVehicleKey("BMW", "X7 xDrive 40d DPE (6인승)");
  const bnkKey = extractVehicleKey("BMW", "The New X7 디젤 3.0 40d");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("BMW_X7_40D");
});

test("parity: BENZ E220d MG → BENZ_E220D", () => {
  expect(extractVehicleKey("BENZ", "E 220d 4Matic Exclusive")).toBe("BENZ_E220D");
});

test("parity: BENZ CLE53 BNK → BENZ_CLE53", () => {
  expect(
    extractVehicleKey("BENZ", "The All New CLE 가솔린 3.0 AMG 카브리올레 CLE 53 AMG 4Matic+"),
  ).toBe("BENZ_CLE53");
});

test("parity: AUDI A3 MG vs BNK → same key", () => {
  const mgKey = extractVehicleKey("AUDI", "A3 40 TFSI Premium");
  const bnkKey = extractVehicleKey("AUDI", "The New A3 가솔린 2.0 40 TFSI Sedan");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("AUDI_A3");
});

test("parity: AUDI A7 BNK → AUDI_A7", () => {
  expect(extractVehicleKey("AUDI", "The New A7 디젤 3.0 50 TDI Quattro Premium")).toBe("AUDI_A7");
});

test("parity: VOLVO XC40 MG vs BNK → same key", () => {
  const mgKey = extractVehicleKey("VOLVO", "XC40 B4 AWD Ultra Dark");
  const bnkKey = extractVehicleKey("VOLVO", "The New XC40 가솔린 2.0 MHEV B4 Plus Bright AWD");
  expect(mgKey).toBe(bnkKey);
  expect(mgKey).toBe("VOLVO_XC40");
});

test("parity: LEXUS RX350H → LEXUS_RX350H", () => {
  expect(extractVehicleKey("LEXUS", "RX 350h")).toBe("LEXUS_RX350H");
});

// ---------------------------------------------------------------------------
// resolveModelNameByVehicleKey
// ---------------------------------------------------------------------------

const mgCandidates = [
  { brand: "BMW", modelName: "520i" },
  { brand: "BMW", modelName: "320d Sedan" },
  { brand: "BMW", modelName: "X7 xDrive 40d DPE (6인승)" },
  { brand: "BENZ", modelName: "E 220d 4Matic Exclusive" },
  { brand: "AUDI", modelName: "A3 40 TFSI Premium" },
  { brand: "VOLVO", modelName: "XC40 B4 AWD Ultra Dark" },
];

test("resolve: BNK 520i name → MG 520i candidate", () => {
  const result = resolveModelNameByVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i", mgCandidates);
  expect(result?.modelName).toBe("520i");
});

test("resolve: BNK 320d name → MG 320d candidate", () => {
  const result = resolveModelNameByVehicleKey("BMW", "The New 3 Series 디젤 2.0 320d", mgCandidates);
  expect(result?.modelName).toBe("320d Sedan");
});

test("resolve: BNK X7 name → MG X7 candidate", () => {
  const result = resolveModelNameByVehicleKey("BMW", "The New X7 디젤 3.0 40d", mgCandidates);
  expect(result?.modelName).toBe("X7 xDrive 40d DPE (6인승)");
});

test("resolve: BNK VOLVO XC40 → MG XC40 candidate", () => {
  const result = resolveModelNameByVehicleKey("VOLVO", "The New XC40 가솔린 2.0 MHEV B4 Plus Bright AWD", mgCandidates);
  expect(result?.modelName).toBe("XC40 B4 AWD Ultra Dark");
});

test("resolve: no matching candidate → null", () => {
  const result = resolveModelNameByVehicleKey("BMW", "740i xDrive", mgCandidates);
  expect(result).toBe(null);
});

test("resolve: unknown brand → null", () => {
  const result = resolveModelNameByVehicleKey("PORSCHE", "911 Carrera", mgCandidates);
  expect(result).toBe(null);
});

test("resolve: empty candidates → null", () => {
  const result = resolveModelNameByVehicleKey("BMW", "520i", []);
  expect(result).toBe(null);
});

test("resolve: works with extended candidate objects", () => {
  const candidates = [
    { brand: "BMW", modelName: "520i", vehiclePrice: 70000000, id: 1 },
    { brand: "BMW", modelName: "320d Sedan", vehiclePrice: 55000000, id: 2 },
  ];
  const result = resolveModelNameByVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i", candidates);
  expect(result?.id).toBe(1);
  expect(result?.vehiclePrice).toBe(70000000);
});

// ---------------------------------------------------------------------------
// Extended coverage — Korean model names + WOORI/BNK specific patterns
// (added 2026-04-18 during cross-lender matching improvement)
// ---------------------------------------------------------------------------

// BMW iX1 / iX2 (numbered electric SUVs)
test("BMW iX1 WOORI vs BNK cross match", () => {
  expect(extractVehicleKey("BMW", "iX1 xDrive30")).toBe("BMW_IX1_30");
  expect(extractVehicleKey("BMW", "iX1 전기 xDrive30 M Sport Package")).toBe("BMW_IX1_30");
});

test("BMW iX2 WOORI vs BNK cross match", () => {
  expect(extractVehicleKey("BMW", "iX2 eDrive20")).toBe("BMW_IX2_20");
  expect(extractVehicleKey("BMW", "New iX2 전기 eDrive20 M Sport Package")).toBe("BMW_IX2_20");
});

// BENZ EQ 2-digit AMG models (EQS 53)
test("BENZ EQS 53 AMG (2-digit)", () => {
  expect(extractVehicleKey("BENZ", "EQS 53 AMG 4Matic+")).toBe("BENZ_EQS53");
  expect(extractVehicleKey("Benz", "AMG EQS 53 4Matic")).toBe("BENZ_EQS53");
});

test("BENZ EQB300 (no space between class and number)", () => {
  expect(extractVehicleKey("Benz", "EQB300 4MATIC(Pre-Facelift)(5인승)")).toBe("BENZ_EQB300");
});

test("BENZ EQS SUV 450 (SUV word between class and number)", () => {
  expect(extractVehicleKey("BENZ", "EQS SUV 450 4Matic")).toBe("BENZ_EQS450");
});

// BENZ Maybach variants
test("BENZ Maybach S580", () => {
  expect(extractVehicleKey("BENZ", "Maybach S 580 4Matic")).toBe("BENZ_MAYBACH_S580");
  expect(extractVehicleKey("Benz", "Maybach S580 4Matic L")).toBe("BENZ_MAYBACH_S580");
});

// BENZ AMG GT bare (no number) / GT R / GT C
test("BENZ AMG GT R / GT C bare", () => {
  expect(extractVehicleKey("Benz", "AMG GT")).toBe("BENZ_GT");
  expect(extractVehicleKey("Benz", "AMG GT R")).toBe("BENZ_GTR");
  expect(extractVehicleKey("Benz", "AMG GT C Roadster")).toBe("BENZ_GTC");
});

test("BENZ Sprinter commercial van", () => {
  expect(extractVehicleKey("Benz", "스프린터 519CDI(15인승)")).toBe("BENZ_SPRINTER519");
});

// BENZ CLA 45 S (BNK writes as "CLA-Class ... AMG 45 S" where CLA is split from number)
test("BENZ CLA 45 AMG (BNK duplicate CLA-Class + AMG 45 S)", () => {
  expect(extractVehicleKey("BENZ", "CLA 45 S 4Matic AMG")).toBe("BENZ_CLA45");
  expect(extractVehicleKey("벤츠", "The New CLA-Class 가솔린 2.0 AMG 45 S AMG 4Matic+")).toBe(
    "BENZ_CLA45",
  );
});

// AUDI e-tron non-adjacent prefix (WOORI "Q4 40 e-tron")
test("AUDI Q4 e-tron cross: MG vs WOORI word order", () => {
  expect(extractVehicleKey("AUDI", "Q4 e-tron 40")).toBe("AUDI_Q4_ETRON");
  expect(extractVehicleKey("Audi", "Q4 40 e-tron")).toBe("AUDI_Q4_ETRON");
  expect(extractVehicleKey("Audi", "Q4 Sportback 45 e-tron")).toBe("AUDI_Q4_ETRON");
});

test("AUDI Q6 e-tron (BNK and WOORI)", () => {
  expect(extractVehicleKey("Audi", "Q6 e-tron performance")).toBe("AUDI_Q6_ETRON");
  expect(extractVehicleKey("아우디", "The new Q6 e-tron Performance Performance")).toBe(
    "AUDI_Q6_ETRON",
  );
});

// TOYOTA Korean aliases
test("TOYOTA Korean model aliases", () => {
  expect(extractVehicleKey("Toyota", "캠리 2.5 Hybrid")).toBe("TOYOTA_CAMRY");
  expect(extractVehicleKey("Toyota", "New 시에나 HEV_2WD")).toBe("TOYOTA_SIENNA");
  expect(extractVehicleKey("Toyota", "하이랜더")).toBe("TOYOTA_HIGHLANDER");
  expect(extractVehicleKey("Toyota", "알파드")).toBe("TOYOTA_ALPHARD");
  expect(extractVehicleKey("Toyota", "RAV 4 하이브리드")).toBe("TOYOTA_RAV4");
});

// HONDA Korean
test("HONDA 어코드 (Accord Korean)", () => {
  expect(extractVehicleKey("Honda", "어코드 1.5")).toBe("HONDA_ACCORD");
  expect(extractVehicleKey("Honda", "어코드 2.0 Hybrid")).toBe("HONDA_ACCORD");
});

// JEEP Korean
test("JEEP 레니게이드 / 그랜드체로키 / 체로키 (Korean)", () => {
  expect(extractVehicleKey("Jeep", "JEEP 레니게이드 2.4")).toBe("JEEP_RENEGADE");
  expect(extractVehicleKey("Jeep", "JEEP 그랜드체로키 3.6")).toBe("JEEP_GRANDCHEROKEE");
});

// LANDROVER Korean
test("LANDROVER 디스커버리 / 레인지로버 / 벨라 / 이보크 / 스포츠", () => {
  expect(extractVehicleKey("Landrover", "디스커버리 D250")).toBe("LR_DISCOVERY");
  expect(extractVehicleKey("Landrover", "디스커버리 스포츠 P200 가솔린")).toBe(
    "LR_DISCOVERYSPORT",
  );
  expect(extractVehicleKey("Landrover", "레인지로버 P530")).toBe("LR_RANGEROVER");
  expect(extractVehicleKey("Landrover", "레인지로버 스포츠 D300")).toBe("LR_RRSPORT");
  expect(extractVehicleKey("Landrover", "레인지로버 벨라 P250")).toBe("LR_RRVELAR");
  expect(extractVehicleKey("Landrover", "레인지로버 이보크 P250")).toBe("LR_RREVOQUE");
});

// CADILLAC Korean
test("CADILLAC 에스컬레이드", () => {
  expect(extractVehicleKey("Cadillac", "에스컬레이드 6.2")).toBe("CADILLAC_ESCALADE");
});

// FORD delegates to LINCOLN for 링컨 prefix (WOORI puts Lincoln models under Ford brand)
test("FORD 링컨 prefix delegates to Lincoln key", () => {
  expect(extractVehicleKey("Ford", "링컨 Navigator")).toBe("LINCOLN_NAVIGATOR");
  expect(extractVehicleKey("Ford", "링컨 All New Aviator 3.0")).toBe("LINCOLN_AVIATOR");
  expect(extractVehicleKey("Ford", "링컨 All New Nautilus")).toBe("LINCOLN_NAUTILUS");
  expect(extractVehicleKey("Ford", "링컨 Corsair 2.0")).toBe("LINCOLN_CORSAIR");
});

// FORD Korean
test("FORD 브롱코 / 레인저 / 머스탱", () => {
  expect(extractVehicleKey("Ford", "브롱코")).toBe("FORD_BRONCO");
  expect(extractVehicleKey("Ford", "레인저(화물픽업)")).toBe("FORD_RANGER");
});

// FERRARI 488 / 12 CILINDRI (space)
test("FERRARI 488 스파이더 / 12 CILINDRI (space)", () => {
  expect(extractVehicleKey("Ferrari", "488 스파이더")).toBe("FERRARI_488");
  expect(extractVehicleKey("Ferrari", "12 CILINDRI")).toBe("FERRARI_12CILINDRI");
});

// MINI WOORI format "COOPER CLUBMAN S (2.0)" vs MG "MINI Clubman Cooper S Classic"
test("MINI Clubman S cross match (WOORI vs MG naming convention)", () => {
  expect(extractVehicleKey("MINI", "MINI Clubman Cooper S Classic")).toBe("MINI_CLUBMAN_COOPER_S");
  expect(extractVehicleKey("MINI", "COOPER CLUBMAN S (2.0)")).toBe("MINI_CLUBMAN_COOPER_S");
});

test("MINI Countryman / Hatch variant cross-match", () => {
  expect(extractVehicleKey("MINI", "COOPER COUNTRYMAN S (2.0)")).toBe("MINI_COUNTRYMAN_COOPER_S");
  expect(extractVehicleKey("MINI", "COOPER Hatch S (2.0)")).toBe("MINI_HATCH_COOPER_S");
  expect(extractVehicleKey("MINI", "COOPER CONVERTIBLE S (2.0)")).toBe(
    "MINI_CONVERTIBLE_COOPER_S",
  );
});

// PORSCHE Taycan Cross Turismo (WOORI uses Korean "크로스투리스모")
test("PORSCHE Taycan Cross Turismo (MG English vs WOORI Korean)", () => {
  expect(extractVehicleKey("PORSCHE", "Taycan Cross Turismo S")).toBe("PORSCHE_TAYCAN_CROSS");
  expect(extractVehicleKey("Porsche", "Taycan 크로스투리스모 4")).toBe("PORSCHE_TAYCAN_CROSS");
  expect(extractVehicleKey("Porsche", "Taycan 크로스투리스모 Turbo")).toBe("PORSCHE_TAYCAN_CROSS");
});

// PORSCHE 911 Carrera GTS ordering (BNK puts GTS before Carrera, MG after)
test("PORSCHE 911 Carrera GTS ordering fix", () => {
  expect(extractVehicleKey("PORSCHE", "911 Carrera GTS")).toBe("PORSCHE_911_CARRERAGTS");
  expect(extractVehicleKey("포르쉐", "911 8세대 카레라 가솔린 3.0 쿠페 GTS Carrera")).toBe(
    "PORSCHE_911_CARRERAGTS",
  );
  expect(extractVehicleKey("PORSCHE", "911 Carrera 4 GTS Cabriolet")).toBe(
    "PORSCHE_911_CARRERA4GTS",
  );
  expect(extractVehicleKey("포르쉐", "911 8세대 카레라 가솔린 3.0 쿠페 GTS Carrera 4")).toBe(
    "PORSCHE_911_CARRERA4GTS",
  );
});

// MASERATI new models (BNK)
test("MASERATI new models — MC20 / MCPura / GT2", () => {
  expect(extractVehicleKey("마세라티", "MC20 Cielo 가솔린 3.0 Fuoriserie by Fujiwara Hiroshi")).toBe(
    "MASERATI_MC20",
  );
  expect(extractVehicleKey("마세라티", "MCPura 가솔린 3.0 V6")).toBe("MASERATI_MCPURA");
  expect(extractVehicleKey("마세라티", "GT2 Stradale 가솔린 3.0 V6")).toBe("MASERATI_GT2");
});

// JAGUAR XJ
test("JAGUAR XJ (with number suffix)", () => {
  expect(extractVehicleKey("Jaguar", "XJ50 LWB")).toBe("LR_XJ");
});

// BENTLEY Flying Spur variants (ALL NEW prefix)
test("BENTLEY ALL NEW FLYING SPUR", () => {
  expect(extractVehicleKey("Bentley", "ALL NEW FLYING SPUR")).toBe("BENTLEY_FLYINGSPUR");
});

// LEXUS LC Convertible (WOORI short form with Korean body noise) — aligned to MG's
// verbose "LC Convertible 500 Sport+" key since LC 500 is the only LC convertible variant.
test("LEXUS LC Convertible WOORI short form", () => {
  expect(extractVehicleKey("Lexus", "LC 컨버터블")).toBe("LEXUS_LC500_CONV");
  expect(extractVehicleKey("LEXUS", "LC Convertible 500 Sport+")).toBe("LEXUS_LC500_CONV");
});

// HYUNDAI Korean model extraction
test("HYUNDAI Korean model names", () => {
  expect(extractVehicleKey("현대", "디 올 뉴 그랜저 HEV 가솔린 1.6 하이브리드 익스클루시브")).toBe(
    "HYUNDAI_GRANDEUR",
  );
  expect(extractVehicleKey("현대", "디 올 뉴 넥쏘 수소전기 익스클루시브")).toBe("HYUNDAI_NEXO");
  expect(extractVehicleKey("현대", "더 뉴 마이티 2.5톤 카고")).toBe("HYUNDAI_MIGHTY");
});

// KIA Korean model extraction
test("KIA Korean model names", () => {
  expect(extractVehicleKey("기아", "디 올 뉴 니로 HEV 가솔린 1.6 하이브리드 시그니처")).toBe(
    "KIA_NIRO",
  );
  expect(extractVehicleKey("기아", "더 뉴 모닝 가솔린 1.0 시그니처")).toBe("KIA_MORNING");
  expect(extractVehicleKey("기아", "더 뉴 봉고3 특장차")).toBe("KIA_BONGO");
});

// --- Bidirectional audit regression fixes (2026-04-18) ---

// PORSCHE 911 — BNK uses Korean body-style tokens (타르가 = Targa, 카레라 = Carrera).
// Before the fix, stripNoise removed 카레라 and the key collapsed to bare PORSCHE_911.
test("PORSCHE 911 — BNK Korean 타르가 / 카레라 body tokens", () => {
  // 타르가 (Targa) — plain & variant
  expect(
    extractVehicleKey("포르쉐", "911 8세대 타르가 가솔린 3.0 Targa 4"),
  ).toBe("PORSCHE_911_TARGA");
  expect(
    extractVehicleKey("포르쉐", "911 8세대 타르가 가솔린 3.0 Targa 4S"),
  ).toBe("PORSCHE_911_TARGA");
  expect(
    extractVehicleKey("포르쉐", "911 8세대 타르가 가솔린 3.0 GTS Edition 50 Years Porsche Design"),
  ).toBe("PORSCHE_911_TARGA");
  expect(
    extractVehicleKey("포르쉐", "911 8세대 타르가 가솔린 3.0 GTS Targa 4"),
  ).toBe("PORSCHE_911_TARGA4GTS");
  // 카레라 (Carrera) — BNK row with no Latin CARRERA token before a variant marker
  expect(
    extractVehicleKey("포르쉐", "The New 911 카레라 가솔린 3.6 카브리올레 GTS Spirit 70"),
  ).toBe("PORSCHE_911_CARRERAGTS");
  expect(
    extractVehicleKey("포르쉐", "911 8세대 카레라 가솔린 3.0 쿠페 Carrera"),
  ).toBe("PORSCHE_911_CARRERA");
});

// MINI — WOORI prefixes all MINI vehicles with "COOPER " as a brand noise word. When the
// electric base model appears (Aceman E / Countryman E), the earlier logic wrongly stamped
// a COOPER variant; it now returns the bare line.
test("MINI — WOORI COOPER brand-prefix + bare electric base (Aceman E / Countryman E)", () => {
  expect(extractVehicleKey("MINI", "COOPER Aceman E")).toBe("MINI_ACEMAN");
  expect(extractVehicleKey("MINI", "COOPER COUNTRYMAN E")).toBe("MINI_COUNTRYMAN");
  // BNK equivalents must produce the same bare key
  expect(extractVehicleKey("미니", "Aceman 전기 E Classic")).toBe("MINI_ACEMAN");
  expect(extractVehicleKey("미니", "The New ALL Electric Countryman 전기 E Classic")).toBe(
    "MINI_COUNTRYMAN",
  );
  // Regression: Aceman SE must still carry the _COOPER_SE variant (SE beats bare E)
  expect(extractVehicleKey("MINI", "COOPER Aceman SE")).toBe("MINI_ACEMAN_COOPER_SE");
  // Regression: Aceman JCW must still carry _JCW
  expect(extractVehicleKey("MINI", "COOPER JCW Aceman E")).toBe("MINI_ACEMAN_JCW");
});

// AUDI — BNK sedan e-tron lineage (S6 e-tron, A6 e-tron) — extend body prefix regex
// so the sedan e-tron keys don't collapse to bare AUDI_ETRON.
test("AUDI — BNK sedan e-tron (S6/A6/A8) body prefix", () => {
  expect(extractVehicleKey("아우디", "S6 e-tron 전기 e-tron")).toBe("AUDI_S6_ETRON");
  expect(extractVehicleKey("아우디", "The New A6 e-tron 전기 Performance Advanced")).toBe(
    "AUDI_A6_ETRON",
  );
  // Regression: SUV e-tron keys unchanged
  expect(extractVehicleKey("아우디", "The new Q6 e-tron Performance Performance")).toBe(
    "AUDI_Q6_ETRON",
  );
  expect(extractVehicleKey("AUDI", "Q4 e-tron 40")).toBe("AUDI_Q4_ETRON");
});

// LEXUS LC Convertible (WOORI short form vs MG verbose)
test("LEXUS — LC Convertible normalizes to LC500 across MG/WOORI", () => {
  expect(extractVehicleKey("Lexus", "LC 컨버터블")).toBe("LEXUS_LC500_CONV");
  expect(extractVehicleKey("LEXUS", "LC Convertible 500 Sport+")).toBe("LEXUS_LC500_CONV");
});

// BMW M-performance 3-digit: MG keeps the petrol "i" suffix ("M235i Gran Coupe"), BNK drops
// it ("M235 xDrive"). Normalize both to the same key so the same physical car matches across
// lenders. Only the "Li" suffix (long-wheelbase + injection) is preserved (760Li).
test("BMW M-performance 3-digit — MG 'M235i' ↔ BNK 'M235' same key", () => {
  expect(extractVehicleKey("BMW", "M235i Gran Coupe xDrive")).toBe("BMW_M235");
  expect(extractVehicleKey("BMW", "The New 2 Series 그란쿠페 가솔린 2.0 M235 xDrive")).toBe(
    "BMW_M235",
  );
  expect(extractVehicleKey("BMW", "M340i Sedan")).toBe("BMW_M340");
  expect(extractVehicleKey("BMW", "M240i Coupe xDrive")).toBe("BMW_M240");
  expect(extractVehicleKey("BMW", "M440i")).toBe("BMW_M440");
  expect(extractVehicleKey("BMW", "M550i xDrive")).toBe("BMW_M550");
  expect(extractVehicleKey("BMW", "M135 xDrive")).toBe("BMW_M135");
  expect(extractVehicleKey("BMW", "M850i xDrive Gran Coupe")).toBe("BMW_M850");
  // Li suffix must still survive (760Li long-wheelbase)
  expect(extractVehicleKey("BMW", "M 760Li xDrive")).toBe("BMW_M760LI");
});
