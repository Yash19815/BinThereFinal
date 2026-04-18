import express from "express";
import pkg from "sqlite3";
const { Database } = pkg;
import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, "bins.db");

// Fixed IST offset (UTC+05:30) - no daylight savings, so it's safe to hardcode.
const IST_OFFSET_MINUTES = 330;
const IST_TIME_ZONE = "Asia/Kolkata";

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const istTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function validateYmd(ymd) {
  return typeof ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

function istYmdToUtcIso(ymd, hour, minute, second, millisecond) {
  const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
  const utcMs = Date.UTC(y, m - 1, d, hour, minute, second, millisecond);
  const utcMsAdjusted = utcMs - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMsAdjusted).toISOString();
}

function formatIstDate(isoString) {
  if (!isoString) return "";
  return istDateFormatter.format(new Date(isoString));
}

function formatIstTime(isoString) {
  if (!isoString) return "";
  return istTimeFormatter.format(new Date(isoString));
}

function formatIstDateTime(isoString) {
  if (!isoString) return "";
  return `${formatIstDate(isoString)} ${formatIstTime(isoString)}`;
}

/**
 * GET /api/export/excel
 * Exports bins + filtered measurements (+ filtered fill_cycles) to Excel.
 *
 * Query params:
 *  - from: YYYY-MM-DD (interpreted as IST date)
 *  - to:   YYYY-MM-DD (interpreted as IST date, inclusive to 23:59:59.999)
 */
router.get("/export/excel", async (req, res) => {
  const db = new Database(DB_PATH, pkg.OPEN_READONLY, (err) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).json({ error: "Failed to connect to database" });
    }
  });

  try {
    const { from, to } = req.query;
    if (from && !validateYmd(from)) {
      return res
        .status(400)
        .json({ error: "Invalid 'from' date format (expected YYYY-MM-DD)" });
    }
    if (to && !validateYmd(to)) {
      return res
        .status(400)
        .json({ error: "Invalid 'to' date format (expected YYYY-MM-DD)" });
    }

    const fromUtcIso = from ? istYmdToUtcIso(from, 0, 0, 0, 0) : null;
    const toUtcIso   = to   ? istYmdToUtcIso(to, 23, 59, 59, 999) : null;

    const measurementConditions = [];
    const measurementParams = [];
    if (fromUtcIso) {
      measurementConditions.push("timestamp >= ?");
      measurementParams.push(fromUtcIso);
    }
    if (toUtcIso) {
      measurementConditions.push("timestamp <= ?");
      measurementParams.push(toUtcIso);
    }
    const measurementWhere = measurementConditions.length
      ? `WHERE ${measurementConditions.join(" AND ")}`
      : "";

    const fillCycleConditions = [];
    const fillCycleParams = [];
    if (fromUtcIso) {
      fillCycleConditions.push("filled_at >= ?");
      fillCycleParams.push(fromUtcIso);
    }
    if (toUtcIso) {
      fillCycleConditions.push("filled_at <= ?");
      fillCycleParams.push(toUtcIso);
    }
    const fillCycleWhere = fillCycleConditions.length
      ? `WHERE ${fillCycleConditions.join(" AND ")}`
      : "";

    const [bins, measurements, fillCycles] = await Promise.all([
      queryDatabase(db, "SELECT * FROM bins ORDER BY id"),
      queryDatabase(
        db,
        `SELECT * FROM measurements ${measurementWhere} ORDER BY timestamp DESC`,
        measurementParams,
      ),
      queryDatabase(
        db,
        `SELECT * FROM fill_cycles ${fillCycleWhere} ORDER BY filled_at DESC`,
        fillCycleParams,
      ),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BinThere Dashboard";
    workbook.created = new Date();

    createBinsSheet(workbook, bins);
    createMeasurementsSheet(workbook, measurements);
    createFillCyclesSheet(workbook, fillCycles);
    createHeatmapSheet(workbook, fillCycles);
    createTrendSheet(workbook, fillCycles);
    createSummarySheet(workbook, bins, measurements, fillCycles);

    const filename = `binthere_export_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res
      .status(500)
      .json({ error: "Failed to generate Excel file", details: error.message });
  } finally {
    db.close();
  }
});

// ─── Helper: promisify sqlite3 queries ───────────────────────────────────────

function queryDatabase(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ─── Shared style helpers ────────────────────────────────────────────────────

function solidFill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function thinBorder(argb) {
  const s = { style: "thin", color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}

// ─── Bins sheet (unchanged) ───────────────────────────────────────────────────

function createBinsSheet(workbook, bins) {
  const sheet = workbook.addWorksheet("Bins");

  sheet.columns = [
    { header: "ID",              key: "id",            width: 10 },
    { header: "Name",            key: "name",          width: 20 },
    { header: "Location",        key: "location",      width: 25 },
    { header: "Max Height (cm)", key: "max_height_cm", width: 18 },
  ];

  styleHeaderRow(sheet);
  bins.forEach((bin) => sheet.addRow(bin));
  sheet.getColumn("max_height_cm").numFmt = "0.00";
}

// ─── Measurements sheet: side-by-side Dry (A–G) | sep (H) | Wet (I–O) ───────

function createMeasurementsSheet(workbook, measurements) {
  const sheet = workbook.addWorksheet("Measurements", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Column widths: A–G dry | H sep | I–O wet
  const COL_WIDTHS = [10, 10, 15, 18, 15, 14, 14, 4, 10, 10, 15, 18, 15, 14, 14];
  COL_WIDTHS.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const DRY_TITLE_COLOR  = "FF1F4E79";
  const WET_TITLE_COLOR  = "FF375623";
  const DRY_HEADER_COLOR = "FF2E75B6";
  const WET_HEADER_COLOR = "FF548235";
  const DRY_EVEN_COLOR   = "FFDEEAF1";
  const WET_EVEN_COLOR   = "FFE2EFDA";

  // Row 1: title bars
  sheet.getRow(1).height = 22;
  sheet.mergeCells("A1:G1");
  const dryTitle     = sheet.getCell("A1");
  dryTitle.value     = "DRY WASTE";
  dryTitle.font      = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  dryTitle.fill      = solidFill(DRY_TITLE_COLOR);
  dryTitle.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("I1:O1");
  const wetTitle     = sheet.getCell("I1");
  wetTitle.value     = "WET WASTE";
  wetTitle.font      = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  wetTitle.fill      = solidFill(WET_TITLE_COLOR);
  wetTitle.alignment = { horizontal: "center", vertical: "middle" };

  // Row 2: column headers
  sheet.getRow(2).height = 18;
  const HEADERS = ["ID", "Bin ID", "Compartment", "Raw Distance (cm)", "Fill Level (%)", "Date (IST)", "Time (IST)"];
  HEADERS.forEach((h, i) => {
    const dc       = sheet.getCell(2, i + 1);
    dc.value       = h;
    dc.font        = { bold: true, color: { argb: "FFFFFFFF" } };
    dc.fill        = solidFill(DRY_HEADER_COLOR);
    dc.alignment   = { horizontal: "center", vertical: "middle" };
    dc.border      = thinBorder("FF1F4E79");

    const wc       = sheet.getCell(2, i + 9);
    wc.value       = h;
    wc.font        = { bold: true, color: { argb: "FFFFFFFF" } };
    wc.fill        = solidFill(WET_HEADER_COLOR);
    wc.alignment   = { horizontal: "center", vertical: "middle" };
    wc.border      = thinBorder("FF375623");
  });

  // Split and write data rows
  const dryRows = measurements.filter((m) => m.compartment === "dry");
  const wetRows = measurements.filter((m) => m.compartment === "wet");
  const maxRows = Math.max(dryRows.length, wetRows.length);

  for (let r = 0; r < maxRows; r++) {
    const excelRow = r + 3;
    const isEven   = r % 2 === 1;
    sheet.getRow(excelRow).height = 15;

    if (dryRows[r]) {
      const m      = dryRows[r];
      const bg     = solidFill(isEven ? DRY_EVEN_COLOR : "FFFFFFFF");
      const bdr    = thinBorder("FFBDD7EE");
      const values = [m.id, m.bin_id, m.compartment, m.raw_distance_cm, m.fill_level_percent, formatIstDate(m.timestamp), formatIstTime(m.timestamp)];
      values.forEach((val, i) => {
        const cell     = sheet.getCell(excelRow, i + 1);
        cell.value     = val;
        cell.fill      = bg;
        cell.border    = bdr;
        cell.alignment = { vertical: "middle", horizontal: i === 3 || i === 4 ? "right" : "center" };
        if (i === 3) cell.numFmt = "0.00";
        if (i === 4) cell.numFmt = '0.0"%"';
      });
      if (m.fill_level_percent >= 80) {
        const fc   = sheet.getCell(excelRow, 5);
        fc.fill    = solidFill("FFFFE6E6");
        fc.font    = { bold: true, color: { argb: "FFCC0000" } };
        fc.numFmt  = '0.0"%"';
      }
    }

    if (wetRows[r]) {
      const m      = wetRows[r];
      const bg     = solidFill(isEven ? WET_EVEN_COLOR : "FFFFFFFF");
      const bdr    = thinBorder("FFA9D18E");
      const values = [m.id, m.bin_id, m.compartment, m.raw_distance_cm, m.fill_level_percent, formatIstDate(m.timestamp), formatIstTime(m.timestamp)];
      values.forEach((val, i) => {
        const cell     = sheet.getCell(excelRow, i + 9);
        cell.value     = val;
        cell.fill      = bg;
        cell.border    = bdr;
        cell.alignment = { vertical: "middle", horizontal: i === 3 || i === 4 ? "right" : "center" };
        if (i === 3) cell.numFmt = "0.00";
        if (i === 4) cell.numFmt = '0.0"%"';
      });
      if (m.fill_level_percent >= 80) {
        const fc   = sheet.getCell(excelRow, 13);
        fc.fill    = solidFill("FFFFE6E6");
        fc.font    = { bold: true, color: { argb: "FFCC0000" } };
        fc.numFmt  = '0.0"%"';
      }
    }
  }
}

// ─── Fill Cycles sheet: side-by-side Dry (A–E) | sep (F) | Wet (G–K) ─────────
//
// Compartment column removed — the title rows "DRY FILL CYCLES" / "WET FILL CYCLES"
// make the compartment self-evident.
//
// Dry  → cols 1–5  (A–E): ID | Bin ID | Filled At (IST) | Emptied At (IST) | Duration (hours)
// Sep  → col  6   (F):   empty
// Wet  → cols 7–11 (G–K): same 5 columns

function createFillCyclesSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Fill Cycles", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Column widths: A–E dry | F sep | G–K wet
  const COL_WIDTHS = [10, 10, 22, 22, 18, 4, 10, 10, 22, 22, 18];
  COL_WIDTHS.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const DRY_TITLE_COLOR  = "FF1F4E79";
  const WET_TITLE_COLOR  = "FF375623";
  const DRY_HEADER_COLOR = "FF2E75B6";
  const WET_HEADER_COLOR = "FF548235";
  const DRY_EVEN_COLOR   = "FFDEEAF1";
  const WET_EVEN_COLOR   = "FFE2EFDA";
  const ACTIVE_COLOR     = "FFFFF4E6"; // orange tint for still-full cycles

  // Row 1: title bars
  sheet.getRow(1).height = 22;

  sheet.mergeCells("A1:E1");
  const dryTitle     = sheet.getCell("A1");
  dryTitle.value     = "DRY FILL CYCLES";
  dryTitle.font      = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  dryTitle.fill      = solidFill(DRY_TITLE_COLOR);
  dryTitle.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("G1:K1");
  const wetTitle     = sheet.getCell("G1");
  wetTitle.value     = "WET FILL CYCLES";
  wetTitle.font      = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  wetTitle.fill      = solidFill(WET_TITLE_COLOR);
  wetTitle.alignment = { horizontal: "center", vertical: "middle" };

  // Row 2: column headers
  sheet.getRow(2).height = 18;
  const HEADERS = ["ID", "Bin ID", "Filled At (IST)", "Emptied At (IST)", "Duration (hours)"];
  HEADERS.forEach((h, i) => {
    const dc       = sheet.getCell(2, i + 1);   // dry: cols 1–5
    dc.value       = h;
    dc.font        = { bold: true, color: { argb: "FFFFFFFF" } };
    dc.fill        = solidFill(DRY_HEADER_COLOR);
    dc.alignment   = { horizontal: "center", vertical: "middle" };
    dc.border      = thinBorder("FF1F4E79");

    const wc       = sheet.getCell(2, i + 7);   // wet: cols 7–11
    wc.value       = h;
    wc.font        = { bold: true, color: { argb: "FFFFFFFF" } };
    wc.fill        = solidFill(WET_HEADER_COLOR);
    wc.alignment   = { horizontal: "center", vertical: "middle" };
    wc.border      = thinBorder("FF375623");
  });

  // Split by compartment
  const dryRows = fillCycles.filter((c) => c.compartment === "dry");
  const wetRows = fillCycles.filter((c) => c.compartment === "wet");
  const maxRows = Math.max(dryRows.length, wetRows.length);

  for (let r = 0; r < maxRows; r++) {
    const excelRow = r + 3;
    const isEven   = r % 2 === 1;
    sheet.getRow(excelRow).height = 15;

    // ── Dry side (cols 1–5) ──────────────────────────────────────────────
    if (dryRows[r]) {
      const c          = dryRows[r];
      const isActive   = !c.emptied_at;
      const rowBgArgb  = isActive ? ACTIVE_COLOR : (isEven ? DRY_EVEN_COLOR : "FFFFFFFF");
      const bg         = solidFill(rowBgArgb);
      const bdr        = thinBorder("FFBDD7EE");

      let duration;
      if (c.filled_at && c.emptied_at) {
        duration = ((new Date(c.emptied_at) - new Date(c.filled_at)) / (1000 * 60 * 60)).toFixed(2);
      } else {
        duration = "Still Full";
      }

      const values = [
        c.id,
        c.bin_id,
        formatIstDateTime(c.filled_at),
        c.emptied_at ? formatIstDateTime(c.emptied_at) : "",
        duration,
      ];

      values.forEach((val, i) => {
        const cell     = sheet.getCell(excelRow, i + 1);
        cell.value     = val;
        cell.fill      = bg;
        cell.border    = bdr;
        cell.alignment = { vertical: "middle", horizontal: i === 0 || i === 1 ? "center" : (i === 4 ? "right" : "left") };
        if (i === 4 && typeof val === "string" && val !== "Still Full") cell.numFmt = "0.00";
      });
    }

    // ── Wet side (cols 7–11) ─────────────────────────────────────────────
    if (wetRows[r]) {
      const c          = wetRows[r];
      const isActive   = !c.emptied_at;
      const rowBgArgb  = isActive ? ACTIVE_COLOR : (isEven ? WET_EVEN_COLOR : "FFFFFFFF");
      const bg         = solidFill(rowBgArgb);
      const bdr        = thinBorder("FFA9D18E");

      let duration;
      if (c.filled_at && c.emptied_at) {
        duration = ((new Date(c.emptied_at) - new Date(c.filled_at)) / (1000 * 60 * 60)).toFixed(2);
      } else {
        duration = "Still Full";
      }

      const values = [
        c.id,
        c.bin_id,
        formatIstDateTime(c.filled_at),
        c.emptied_at ? formatIstDateTime(c.emptied_at) : "",
        duration,
      ];

      values.forEach((val, i) => {
        const cell     = sheet.getCell(excelRow, i + 7);  // +6 offset → col G onward
        cell.value     = val;
        cell.fill      = bg;
        cell.border    = bdr;
        cell.alignment = { vertical: "middle", horizontal: i === 0 || i === 1 ? "center" : (i === 4 ? "right" : "left") };
        if (i === 4 && typeof val === "string" && val !== "Still Full") cell.numFmt = "0.00";
      });
    }
  }
}

// ─── Heatmap sheet ────────────────────────────────────────────────────────
function createHeatmapSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Heatmap Data", {
    properties: { tabColor: { argb: "FFED7D31" } }
  });

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  // Headers: Day, 00:00 to 23:00
  const headers = ["Day"];
  for (let h = 0; h < 24; h++) {
    headers.push(`${h.toString().padStart(2, "0")}:00`);
  }
  sheet.addRow(headers);
  styleHeaderRow(sheet, "FFED7D31"); // Orange theme for Heatmap

  // Initialize 7x24 matrix
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));

  fillCycles.forEach(c => {
    if (!c.filled_at) return;
    const d = new Date(c.filled_at);
    // Convert to IST
    const istMs = d.getTime() + (330 * 60 * 1000);
    const istDate = new Date(istMs);
    
    // Day: 0=Sun, 1=Mon... we want row 0=Mon, 6=Sun
    const jsDay = istDate.getUTCDay();
    const dayRow = (jsDay + 6) % 7; 
    const hr = istDate.getUTCHours();

    matrix[dayRow][hr]++;
  });

  let maxVal = 0;
  for (let r = 0; r < 7; r++) {
    const rowData = [DAYS[r], ...matrix[r]];
    sheet.addRow(rowData);
    for (const val of matrix[r]) {
      if (val > maxVal) maxVal = val;
    }
  }

  // Set column widths
  sheet.getColumn(1).width = 15;
  for (let i = 2; i <= 25; i++) {
    sheet.getColumn(i).width = 8;
  }

  if (maxVal > 0) {
    // Add conditional formatting
    sheet.addConditionalFormatting({
      ref: 'B2:Y8',
      rules: [
        {
          type: 'colorScale',
          cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: maxVal }],
          color: [{ argb: 'FFFFFFFF' }, { argb: 'FFED7D31' }]
        }
      ]
    });
  }
}

// ─── Trend sheet ──────────────────────────────────────────────────────────
function createTrendSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Trend Data", {
    properties: { tabColor: { argb: "FFFFC000" } }
  });

  sheet.addRow(["Date", "Dry Cycles", "Wet Cycles", "Total Cycles"]);
  styleHeaderRow(sheet, "FF5B9BD5");

  // Aggregate by Date
  const dateMap = {};
  fillCycles.forEach(c => {
    if (!c.filled_at) return;
    const d = new Date(c.filled_at);
    const istMs = d.getTime() + (330 * 60 * 1000);
    const istDate = new Date(istMs);
    const dateStr = istDate.toISOString().split("T")[0];

    if (!dateMap[dateStr]) dateMap[dateStr] = { dry: 0, wet: 0, total: 0 };
    if (c.compartment === "dry") dateMap[dateStr].dry++;
    if (c.compartment === "wet") dateMap[dateStr].wet++;
    dateMap[dateStr].total++;
  });

  const sortedDates = Object.keys(dateMap).sort();
  let maxTotal = 0;

  sortedDates.forEach(date => {
    const { dry, wet, total } = dateMap[date];
    if (total > maxTotal) maxTotal = total;
    sheet.addRow([date, dry, wet, total]);
  });

  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 15;

  const numRows = sortedDates.length;
  if (numRows > 0 && maxTotal > 0) {
    sheet.addConditionalFormatting({
      ref: `D2:D${numRows + 1}`,
      rules: [
        {
          type: 'dataBar',
          cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: maxTotal }],
          color: { argb: 'FF5B9BD5' }
        }
      ]
    });
  }
}

// ─── Summary sheet (unchanged) ───────────────────────────────────────────────

function createSummarySheet(workbook, bins, measurements, fillCycles) {
  const sheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: "FF4472C4" } },
  });

  sheet.getColumn("A").width = 30;
  sheet.getColumn("B").width = 20;

  const titleRow = sheet.addRow(["BinThere Export Summary"]);
  titleRow.font = { size: 16, bold: true };
  titleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  titleRow.getCell(1).font.color = { argb: "FFFFFFFF" };
  sheet.addRow([]);

  sheet.addRow(["Export Date:", new Date().toLocaleString()]);
  sheet.addRow([]);

  sheet.addRow(["Statistics"]).font = { bold: true, size: 14 };
  sheet.addRow(["Total Bins:",         bins.length]);
  sheet.addRow(["Total Measurements:", measurements.length]);
  sheet.addRow(["Total Fill Cycles:",  fillCycles.length]);
  sheet.addRow([]);

  const activeCycles = fillCycles.filter((c) => !c.emptied_at).length;
  sheet.addRow(["Active Fill Cycles:",    activeCycles]);
  sheet.addRow(["Completed Fill Cycles:", fillCycles.length - activeCycles]);
  sheet.addRow([]);

  if (measurements.length > 0) {
    sheet.addRow(["Latest Fill Levels"]).font = { bold: true, size: 14 };
    const latestDry = measurements.find((m) => m.compartment === "dry");
    const latestWet = measurements.find((m) => m.compartment === "wet");
    if (latestDry) sheet.addRow(["Dry Compartment:", `${latestDry.fill_level_percent.toFixed(1)}%`]);
    if (latestWet) sheet.addRow(["Wet Compartment:", `${latestWet.fill_level_percent.toFixed(1)}%`]);
  }

  sheet.addRow([]);
  sheet.addRow(["Data Sheets:"]).font = { bold: true, size: 14 };
  sheet.addRow(["• Bins - Physical dustbin units"]);
  sheet.addRow(["• Measurements - Sensor readings"]);
  sheet.addRow(["• Fill Cycles - Fill/empty events"]);
}

// ─── Helper: style header row (row 1) with blue background ───────────────────

function styleHeaderRow(sheet) {
  const headerRow     = sheet.getRow(1);
  headerRow.font      = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height    = 20;
}

export default router;
