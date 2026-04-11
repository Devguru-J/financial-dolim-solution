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
