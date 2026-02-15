/** Convert AD year to ROC year */
export function toRocYear(adYear: number): number {
  return adYear - 1911;
}

/** Convert ROC year to AD year */
export function toAdYear(rocYear: number): number {
  return rocYear + 1911;
}

/** Get current ROC year */
export function currentRocYear(): number {
  return toRocYear(new Date().getFullYear());
}

/** Format a Date as ROC date string: "XXX年MM月DD日" */
export function formatRocDate(date: Date): string {
  const rocYear = toRocYear(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${rocYear}年${month}月${day}日`;
}

/** Calculate full age from date of birth */
export function calculateAge(dob: Date, asOf?: Date): number {
  const now = asOf || new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
