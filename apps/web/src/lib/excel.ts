import * as XLSX from "xlsx";

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportInterfacePoints(points: any[], projectCode = "export") {
  const rows = points.map((p) => ({
    Code: p.code,
    Title: p.title,
    Status: p.status,
    Criticality: p.criticality,
    Phase: p.phase ?? "",
    "Due Date": p.dueDate ?? "",
    Description: p.description ?? "",
    "Agreement Code": p.agreement?.code ?? "",
    "Register Code": p.agreement?.register?.code ?? "",
    "Package A": p.agreement?.register?.packageA?.code ?? "",
    "Package B": p.agreement?.register?.packageB?.code ?? "",
    "Deliverables": (p.deliverables?.length ?? 0),
    "Queries": (p.queries?.length ?? 0),
  }));
  exportToExcel(rows, `interface-points-${projectCode}`);
}

export function exportInterfaceQueries(queries: any[], projectCode = "export") {
  const rows = queries.map((q) => ({
    Code: q.code,
    Subject: q.subject,
    Status: q.status,
    Priority: q.priority,
    "Raised By": q.raisedByPackage?.code ?? "",
    "Assigned To": q.assignedToPackage?.code ?? "",
    "Interface Point": q.interfacePoint?.code ?? "",
    "Due Date": q.dueDate ?? "",
    "Responses": (q.responses?.length ?? 0),
    Description: q.description ?? "",
  }));
  exportToExcel(rows, `interface-queries-${projectCode}`);
}

// Parse uploaded Excel file → array of row objects
export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
