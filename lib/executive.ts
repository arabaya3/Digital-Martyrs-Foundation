export type ExecutiveTransactionFilter =
  | "all"
  | "education"
  | "health"
  | "certificates"
  | "benefits";

export type ExecutiveGovernorateFilter =
  | "all"
  | "baghdad"
  | "basra"
  | "nineveh"
  | "dhiqar"
  | "karbala"
  | "najaf";

export type ExecutivePeriodFilter = "12m" | "6m" | "3m" | "1m";

export const executiveTransactionOptions = [
  { id: "all", ar: "كل المعاملات", en: "All transactions" },
  { id: "education", ar: "المنح التعليمية", en: "Education grants" },
  { id: "health", ar: "الدعم الصحي", en: "Health support" },
  { id: "certificates", ar: "إصدار الشهادات", en: "Certificate issuance" },
  { id: "benefits", ar: "استحقاقات الأسرة", en: "Family benefits" },
] as const;

export const executiveGovernorateOptions = [
  { id: "all", ar: "كل المحافظات", en: "All governorates" },
  { id: "baghdad", ar: "بغداد", en: "Baghdad" },
  { id: "basra", ar: "البصرة", en: "Basra" },
  { id: "nineveh", ar: "نينوى", en: "Nineveh" },
  { id: "dhiqar", ar: "ذي قار", en: "Dhi Qar" },
  { id: "karbala", ar: "كربلاء", en: "Karbala" },
  { id: "najaf", ar: "النجف", en: "Najaf" },
] as const;

export const executivePeriodOptions = [
  { id: "12m", ar: "آخر ١٢ شهراً", en: "Last 12 months" },
  { id: "6m", ar: "آخر ٦ أشهر", en: "Last 6 months" },
  { id: "3m", ar: "آخر ٣ أشهر", en: "Last 3 months" },
  { id: "1m", ar: "تموز ٢٠٢٦", en: "July 2026" },
] as const;

const months = [
  { ar: "آب", en: "Aug" },
  { ar: "أيلول", en: "Sep" },
  { ar: "تشرين ١", en: "Oct" },
  { ar: "تشرين ٢", en: "Nov" },
  { ar: "كانون ١", en: "Dec" },
  { ar: "كانون ٢", en: "Jan" },
  { ar: "شباط", en: "Feb" },
  { ar: "آذار", en: "Mar" },
  { ar: "نيسان", en: "Apr" },
  { ar: "أيار", en: "May" },
  { ar: "حزيران", en: "Jun" },
  { ar: "تموز", en: "Jul" },
];

const baseVolume = [2740, 2920, 3060, 2890, 3280, 3460, 3370, 3680, 3910, 4060, 4240, 4470];
const baseRevenue = [
  78_200_000,
  82_400_000,
  86_100_000,
  80_800_000,
  92_600_000,
  98_400_000,
  95_200_000,
  104_300_000,
  111_700_000,
  116_500_000,
  121_900_000,
  128_400_000,
];
const completion = [88.2, 89.1, 89.8, 90.4, 91.2, 91.8, 92.1, 92.8, 93.4, 94.1, 94.6, 95.2];

const transactionSeasonality: Record<ExecutiveTransactionFilter, number[]> = {
  all: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  education: [1.32, 1.44, 1.18, 0.82, 0.68, 0.62, 0.76, 0.94, 1.08, 1.2, 1.38, 1.5],
  health: [0.92, 1.08, 1.24, 1.31, 1.16, 1.38, 1.42, 1.18, 1.04, 0.96, 1.1, 1.26],
  certificates: [0.72, 0.84, 1.06, 0.94, 1.2, 1.46, 1.22, 0.88, 1.34, 1.12, 0.9, 1.4],
  benefits: [1.18, 1.04, 0.9, 1.26, 1.42, 1.12, 0.86, 1.2, 1.38, 0.98, 1.16, 1.32],
};

const governorateSeasonality: Record<ExecutiveGovernorateFilter, number[]> = {
  all: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  baghdad: [1.08, 1.02, 1.12, 0.96, 1.06, 1.14, 0.98, 1.1, 1.04, 1.16, 1.08, 1.2],
  basra: [0.9, 1.04, 1.18, 1.1, 0.94, 1.08, 1.22, 1.14, 0.98, 1.06, 1.2, 1.12],
  nineveh: [1.16, 1.08, 0.92, 1.02, 1.2, 0.94, 1.06, 1.18, 0.9, 1.12, 1.04, 0.96],
  dhiqar: [0.94, 1.14, 1.02, 1.22, 0.9, 1.08, 1.18, 0.96, 1.12, 1.04, 0.92, 1.16],
  karbala: [1.04, 0.92, 1.1, 1.18, 1.02, 0.94, 1.14, 1.24, 1.08, 0.96, 1.16, 1.06],
  najaf: [1.12, 1.2, 0.96, 1.04, 0.92, 1.16, 1.08, 0.98, 1.22, 1.1, 0.94, 1.18],
};

const transactionProfiles: Record<
  ExecutiveTransactionFilter,
  {
    volumeShare: number;
    revenueShare: number;
    beneficiaryShare: number;
    slaDelta: number;
    satisfactionDelta: number;
    digitalShare: number;
  }
> = {
  all: { volumeShare: 1, revenueShare: 1, beneficiaryShare: 1, slaDelta: 0, satisfactionDelta: 0, digitalShare: 78 },
  education: { volumeShare: 0.31, revenueShare: 0.08, beneficiaryShare: 0.34, slaDelta: 1.1, satisfactionDelta: 0.1, digitalShare: 91 },
  health: { volumeShare: 0.24, revenueShare: 0.22, beneficiaryShare: 0.27, slaDelta: -1.6, satisfactionDelta: -0.2, digitalShare: 62 },
  certificates: { volumeShare: 0.18, revenueShare: 0.38, beneficiaryShare: 0.16, slaDelta: 2.2, satisfactionDelta: 0.2, digitalShare: 95 },
  benefits: { volumeShare: 0.17, revenueShare: 0.17, beneficiaryShare: 0.18, slaDelta: -0.4, satisfactionDelta: 0, digitalShare: 74 },
};

const governorateProfiles: Record<
  ExecutiveGovernorateFilter,
  { share: number; revenueFactor: number; slaDelta: number; satisfactionDelta: number }
> = {
  all: { share: 1, revenueFactor: 1, slaDelta: 0, satisfactionDelta: 0 },
  baghdad: { share: 0.32, revenueFactor: 1.12, slaDelta: 1.5, satisfactionDelta: 0.1 },
  basra: { share: 0.18, revenueFactor: 1.04, slaDelta: 0.2, satisfactionDelta: 0 },
  nineveh: { share: 0.16, revenueFactor: 0.86, slaDelta: -3.2, satisfactionDelta: -0.3 },
  dhiqar: { share: 0.13, revenueFactor: 0.82, slaDelta: -1.4, satisfactionDelta: -0.1 },
  karbala: { share: 0.11, revenueFactor: 0.98, slaDelta: 2.7, satisfactionDelta: 0.2 },
  najaf: { share: 0.1, revenueFactor: 0.96, slaDelta: 1.9, satisfactionDelta: 0.1 },
};

const governorateRows = [
  { id: "baghdad", ar: "بغداد", en: "Baghdad", score: 86, sla: 96.1 },
  { id: "basra", ar: "البصرة", en: "Basra", score: 64, sla: 94.8 },
  { id: "nineveh", ar: "نينوى", en: "Nineveh", score: 58, sla: 91.4 },
  { id: "dhiqar", ar: "ذي قار", en: "Dhi Qar", score: 44, sla: 93.2 },
  { id: "karbala", ar: "كربلاء", en: "Karbala", score: 38, sla: 97.3 },
  { id: "najaf", ar: "النجف", en: "Najaf", score: 35, sla: 95.7 },
] as const;

const periodLength: Record<ExecutivePeriodFilter, number> = {
  "12m": 12,
  "6m": 6,
  "3m": 3,
  "1m": 1,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getExecutiveView(
  transaction: ExecutiveTransactionFilter,
  governorate: ExecutiveGovernorateFilter,
  period: ExecutivePeriodFilter,
) {
  const transactionProfile = transactionProfiles[transaction];
  const governorateProfile = governorateProfiles[governorate];
  const length = periodLength[period];
  const start = months.length - length;
  const scopeShare = governorateProfile.share * transactionProfile.volumeShare;
  const periodFactor = length / 12;
  const transactionCurve = transactionSeasonality[transaction];
  const governorateCurve = governorateSeasonality[governorate];

  const volumes = baseVolume
    .slice(start)
    .map((value, index) =>
      Math.round(
        value *
          scopeShare *
          transactionCurve[start + index] *
          (0.82 + governorateCurve[start + index] * 0.18),
      ),
    );
  const revenue = baseRevenue
    .slice(start)
    .map((value, index) =>
      Math.round(
        value *
          transactionProfile.revenueShare *
          governorateProfile.share *
          governorateProfile.revenueFactor *
          transactionCurve[start + index] *
          governorateCurve[start + index],
      ),
    );
  const completionSeries = completion
    .slice(start)
    .map((value) =>
      Number(
        clamp(
          value + transactionProfile.slaDelta * 0.45 + governorateProfile.slaDelta * 0.35,
          82,
          99.4,
        ).toFixed(1),
      ),
    );
  const maximumVolume = Math.max(...volumes, 1);
  const volumeIndex = volumes.map((value) =>
    Math.round(52 + (value / maximumVolume) * 48),
  );
  const revenueTotal = revenue.reduce((total, value) => total + value, 0);
  const applications = volumes.reduce((total, value) => total + value, 0);
  const completed = Math.round(
    applications * (completionSeries.at(-1)! / 100) * 0.83,
  );
  const sla = clamp(
    94.6 + transactionProfile.slaDelta + governorateProfile.slaDelta,
    84,
    99.4,
  );
  const satisfaction = clamp(
    4.6 +
      transactionProfile.satisfactionDelta +
      governorateProfile.satisfactionDelta,
    3.8,
    4.9,
  );
  const reconciliation = clamp(
    96.8 + transactionProfile.slaDelta * 0.35 + governorateProfile.slaDelta * 0.15,
    90.2,
    99.1,
  );

  const visibleGovernorates = governorateRows
    .filter((row) => governorate === "all" || row.id === governorate)
    .map((row) => ({
      ...row,
      volume: Math.max(
        1,
        Math.round(
          row.score *
            42 *
            transactionProfile.volumeShare *
            Math.max(periodFactor, 1 / 12),
        ),
      ),
      sla: Number(
        clamp(
          row.sla + transactionProfile.slaDelta * 0.6,
          84,
          99.4,
        ).toFixed(1),
      ),
    }));

  return {
    labels: months.slice(start),
    volumes,
    volumeIndex,
    completionSeries,
    revenue,
    revenueTotal,
    applications,
    completed,
    activeBeneficiaries: Math.round(
      486_240 *
        transactionProfile.beneficiaryShare *
        governorateProfile.share,
    ),
    registeredFamilies: Math.round(
      174_820 *
        Math.min(transactionProfile.beneficiaryShare * 1.08, 1) *
        governorateProfile.share,
    ),
    sla: Number(sla.toFixed(1)),
    satisfaction: Number(satisfaction.toFixed(1)),
    reconciliation: Number(reconciliation.toFixed(1)),
    digitalShare: transactionProfile.digitalShare,
    governorates: visibleGovernorates,
  };
}
