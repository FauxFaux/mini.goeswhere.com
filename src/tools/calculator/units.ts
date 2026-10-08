import catalogue from "./units.json";

export interface CalculatorUnit {
  id: string;
  title: string;
  names: string[];
  category: string;
  baseUnit: string;
  definition: string;
  description: string;
}

export const calculatorUnits: CalculatorUnit[] = catalogue.units;

/** Prefix matches across all fields precede substring matches across all fields. */
export function filterUnits(units: readonly CalculatorUnit[], filter: string): CalculatorUnit[] {
  const query = filter.trim().toLowerCase();
  if (!query) return [...units];
  const ranked = units.flatMap((unit, index) => {
    const fields = [[unit.title], unit.names, unit.category.split(" / "), [unit.baseUnit]];
    for (const [matchIndex, matches] of [
      (value: string) => value.startsWith(query),
      (value: string) => value.includes(query),
    ].entries()) {
      const fieldIndex = fields.findIndex((values) =>
        values.some((value) => matches(value.toLowerCase())),
      );
      if (fieldIndex !== -1)
        return [{ unit, rank: matchIndex * fields.length + fieldIndex, index }];
    }
    return [];
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ unit }) => unit);
}

/** Consecutive category groups preserve search ranking, including across categories. */
export function groupUnits(units: readonly CalculatorUnit[]) {
  const groups: { category: string; units: CalculatorUnit[] }[] = [];
  for (const unit of units) {
    const last = groups.at(-1);
    if (last?.category === unit.category) last.units.push(unit);
    else groups.push({ category: unit.category, units: [unit] });
  }
  return groups;
}
