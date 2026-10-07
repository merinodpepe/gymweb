/** Spanish month names → 0-based month index. */
export const MONTHS_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

export function monthIndex(name: string): number | undefined {
  const key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return MONTHS_ES[key];
}
