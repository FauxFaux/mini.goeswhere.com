import type { StrengthStandardsState } from "./state.ts";

/** Original pounds from standards.pdf (The Aasgaard Company, 2012).
 * Each row is bodyweight followed by Categories I–V; the final bodyweight is a lower bound.
 */
export type StandardRow = readonly [number, number, number, number, number, number];

export interface ActivityStandards {
  id: string;
  title: string;
  technique: string;
  men: readonly StandardRow[];
  women: readonly StandardRow[];
}

export const standards: readonly ActivityStandards[] = [
  {
    id: "press",
    title: "Press",
    technique: "Any knee extension makes the attempt invalid.",
    men: [
      [114, 53, 72, 90, 107, 129],
      [123, 57, 78, 98, 116, 141],
      [132, 61, 84, 105, 125, 151],
      [148, 69, 94, 119, 140, 169],
      [165, 75, 102, 129, 153, 186],
      [181, 81, 110, 138, 164, 218],
      [198, 85, 116, 146, 173, 234],
      [220, 89, 122, 155, 183, 255],
      [242, 93, 127, 159, 189, 264],
      [275, 96, 131, 164, 194, 272],
      [319, 98, 133, 167, 199, 278],
      [320, 100, 136, 171, 203, 284],
    ],
    women: [
      [97, 31, 42, 50, 66, 85],
      [105, 33, 46, 53, 71, 91],
      [114, 36, 49, 58, 76, 97],
      [123, 38, 52, 61, 81, 104],
      [132, 40, 55, 65, 85, 110],
      [148, 44, 60, 72, 94, 121],
      [165, 48, 65, 77, 102, 134],
      [181, 51, 70, 83, 110, 140],
      [198, 55, 75, 88, 117, 151],
      [199, 58, 79, 93, 123, 159],
    ],
  },
  {
    id: "bench-press",
    title: "Bench press",
    technique:
      "Do not bounce the bar off the chest. Shoulders and hips must stay on the bench, and feet on the floor.",
    men: [
      [114, 84, 107, 130, 179, 222],
      [123, 91, 116, 142, 194, 242],
      [132, 98, 125, 153, 208, 260],
      [148, 109, 140, 172, 234, 291],
      [165, 119, 152, 187, 255, 319],
      [181, 128, 164, 201, 275, 343],
      [198, 135, 173, 213, 289, 362],
      [220, 142, 183, 225, 306, 381],
      [242, 149, 190, 232, 316, 395],
      [275, 153, 196, 239, 325, 407],
      [319, 156, 199, 244, 333, 416],
      [320, 159, 204, 248, 340, 425],
    ],
    women: [
      [97, 49, 63, 73, 94, 116],
      [105, 53, 68, 79, 102, 124],
      [114, 57, 73, 85, 109, 133],
      [123, 60, 77, 90, 116, 142],
      [132, 64, 82, 95, 122, 150],
      [148, 70, 90, 105, 135, 165],
      [165, 76, 97, 113, 146, 183],
      [181, 81, 104, 122, 158, 192],
      [198, 88, 112, 130, 167, 205],
      [199, 92, 118, 137, 177, 217],
    ],
  },
  {
    id: "squat",
    title: "Squat",
    technique: "Use a full squat: the hip crease must go below the top of the kneecap.",
    men: [
      [114, 78, 144, 174, 240, 320],
      [123, 84, 155, 190, 259, 346],
      [132, 91, 168, 205, 278, 369],
      [148, 101, 188, 230, 313, 410],
      [165, 110, 204, 250, 342, 445],
      [181, 119, 220, 269, 367, 479],
      [198, 125, 232, 285, 387, 504],
      [220, 132, 244, 301, 409, 532],
      [242, 137, 255, 311, 423, 551],
      [275, 141, 261, 319, 435, 567],
      [319, 144, 267, 326, 445, 580],
      [320, 147, 272, 332, 454, 593],
    ],
    women: [
      [97, 46, 84, 98, 129, 163],
      [105, 49, 91, 106, 140, 174],
      [114, 53, 98, 114, 150, 187],
      [123, 56, 103, 121, 160, 199],
      [132, 59, 110, 127, 168, 211],
      [148, 65, 121, 141, 185, 232],
      [165, 70, 130, 151, 200, 256],
      [181, 75, 139, 164, 215, 268],
      [198, 81, 150, 174, 229, 288],
      [199, 85, 158, 184, 242, 303],
    ],
  },
  {
    id: "deadlift",
    title: "Deadlift",
    technique:
      "Use the deadlift technique described in Starting Strength: Basic Barbell Training, 3rd edition.",
    men: [
      [114, 97, 179, 204, 299, 387],
      [123, 105, 194, 222, 320, 414],
      [132, 113, 209, 239, 342, 438],
      [148, 126, 234, 269, 380, 482],
      [165, 137, 254, 293, 411, 518],
      [181, 148, 274, 315, 438, 548],
      [198, 156, 289, 333, 457, 567],
      [220, 164, 305, 351, 479, 586],
      [242, 172, 318, 363, 490, 596],
      [275, 176, 326, 373, 499, 602],
      [319, 180, 333, 381, 506, 608],
      [320, 183, 340, 388, 512, 617],
    ],
    women: [
      [97, 57, 105, 122, 175, 232],
      [105, 61, 114, 132, 189, 242],
      [114, 66, 122, 142, 200, 253],
      [123, 70, 129, 151, 211, 263],
      [132, 74, 137, 159, 220, 273],
      [148, 81, 151, 176, 241, 295],
      [165, 88, 162, 189, 258, 319],
      [181, 94, 174, 204, 273, 329],
      [198, 101, 187, 217, 284, 349],
      [199, 107, 197, 229, 297, 364],
    ],
  },
  {
    id: "power-clean",
    title: "Power clean",
    technique:
      "Use the power clean technique described in Starting Strength: Basic Barbell Training, 3rd edition.",
    men: [
      [114, 56, 103, 125, 173, 207],
      [123, 60, 112, 137, 186, 224],
      [132, 65, 121, 148, 200, 239],
      [148, 73, 135, 166, 225, 266],
      [165, 79, 147, 180, 246, 288],
      [181, 85, 158, 194, 264, 310],
      [198, 90, 167, 205, 279, 327],
      [220, 95, 176, 217, 294, 345],
      [242, 99, 183, 224, 305, 357],
      [275, 102, 188, 230, 313, 367],
      [319, 104, 192, 235, 320, 376],
      [320, 106, 196, 239, 327, 384],
    ],
    women: [
      [97, 33, 61, 70, 93, 117],
      [105, 35, 66, 76, 101, 125],
      [114, 38, 70, 82, 108, 135],
      [123, 40, 74, 87, 115, 143],
      [132, 43, 79, 92, 121, 152],
      [148, 47, 87, 101, 133, 167],
      [165, 50, 93, 109, 144, 184],
      [181, 54, 100, 118, 155, 193],
      [198, 58, 108, 125, 165, 207],
      [199, 61, 114, 132, 174, 218],
    ],
  },
];

export function formatWeight(pounds: number, unit: StrengthStandardsState["unit"]): string {
  return unit === "kg" ? (pounds * POUNDS_TO_KG).toFixed(1) : String(Number(pounds.toFixed(1)));
}

export const POUNDS_TO_KG = 0.45359237;

export function bodyweightBounds(
  sex: StrengthStandardsState["sex"],
  unit: StrengthStandardsState["unit"],
) {
  const rows = standards[0][sex];
  const factor = unit === "kg" ? POUNDS_TO_KG : 1;
  return { min: Math.ceil(rows[0][0] * factor), max: Math.ceil(rows[rows.length - 1][0] * factor) };
}

export function clampBodyweight(
  weight: number,
  sex: StrengthStandardsState["sex"],
  unit: StrengthStandardsState["unit"],
) {
  const { min, max } = bodyweightBounds(sex, unit);
  const factor = unit === "kg" ? POUNDS_TO_KG : 1;
  return Math.min(max, Math.max(min, weight * factor)) / factor;
}

/** Linear interpolation in the original units; the final row applies to all larger weights. */
export function interpolateStandards(
  rows: readonly StandardRow[],
  weight: number,
): StandardRow | null {
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last || !Number.isFinite(weight) || weight < first[0]) return null;
  if (weight >= last[0]) return [weight, last[1], last[2], last[3], last[4], last[5]];
  const upperIndex = rows.findIndex((row) => row[0] >= weight);
  const upper = rows[upperIndex];
  if (upper[0] === weight) return upper;
  const lower = rows[upperIndex - 1];
  const fraction = (weight - lower[0]) / (upper[0] - lower[0]);
  const interpolate = (category: 1 | 2 | 3 | 4 | 5) =>
    lower[category] + fraction * (upper[category] - lower[category]);
  return [weight, interpolate(1), interpolate(2), interpolate(3), interpolate(4), interpolate(5)];
}
