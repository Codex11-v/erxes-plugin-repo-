export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readFile(file: Blob): Promise<string> {
  if (!file.size || file.size > 4 * 1024 * 1024) throw new Error("Файл 4 MB хүртэл байх ёстой.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Файл уншиж чадсангүй."));
    reader.readAsDataURL(file);
  });
}

export function csvCell(value: string | number | null) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula execution in user/AI supplied cells.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export interface GradeRow {
  name: string;
  score: number | null;
  attendance: string;
}
export function parseRows(content: string): GradeRow[] {
  const rows: unknown = JSON.parse(content);
  if (!Array.isArray(rows) || rows.length > 200) throw new Error("Хүснэгтийн бүтэц буруу байна.");
  return rows.map((row: unknown) => {
    if (
      !row ||
      typeof row !== "object" ||
      !("name" in row) ||
      typeof row.name !== "string" ||
      !("score" in row) ||
      (row.score !== null &&
        (typeof row.score !== "number" ||
          !Number.isFinite(row.score) ||
          row.score < 0 ||
          row.score > 100)) ||
      !("attendance" in row) ||
      typeof row.attendance !== "string"
    )
      throw new Error("Хүснэгтийн мөр буруу байна.");
    return { name: row.name, score: row.score, attendance: row.attendance };
  });
}
