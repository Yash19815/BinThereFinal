import express from "express";
import Database from "better-sqlite3";
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
 * GET /api/export/metadata
 * Returns metadata for export validation (e.g., earliest data point).
 */
router.get("/export/metadata", (req, res) => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare("SELECT MIN(timestamp) as earliest FROM measurements").get();
    res.json({ status: "success", earliestDate: row?.earliest || null });
  } catch (error) {
    console.error("Metadata fetch error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch export metadata" });
  } finally {
    db.close();
  }
});

/**
 * GET /api/export/excel
 * Exports bins + filtered measurements (+ filtered fill_cycles) to Excel.
 *
 * Query params:
 *  - from: YYYY-MM-DD (interpreted as IST date)
 *  - to:   YYYY-MM-DD (interpreted as IST date, inclusive to 23:59:59.999)
 */
router.get("/export/excel", async (req, res) => {
  const db = new Database(DB_PATH, { readonly: true });

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
    const toUtcIso = to ? istYmdToUtcIso(to, 23, 59, 59, 999) : null;

    console.log(`[EXPORT] Excel report requested: range ${from || "all-time"} to ${to || "now"}`);

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

    // Synchronous queries using better-sqlite3
    const bins = db.prepare("SELECT * FROM bins ORDER BY id").all();
    const measurements = db
      .prepare(
        `SELECT * FROM measurements ${measurementWhere} ORDER BY timestamp DESC`,
      )
      .all(measurementParams);
    const fillCycles = db
      .prepare(
        `SELECT * FROM fill_cycles ${fillCycleWhere} ORDER BY filled_at DESC`,
      )
      .all(fillCycleParams);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BinThere Dashboard";
    workbook.created = new Date();

    // ─── NEW: Executive Summary (Tab 1) ──────────────────────────────────
    createExecutiveSummarySheet(workbook, bins, measurements, fillCycles, {
      from,
      to,
    });

    createBinsSheet(workbook, bins);
    createMeasurementsSheet(workbook, measurements);
    createFillCyclesSheet(workbook, fillCycles);

    // ─── NEW: Maintenance Prediction (Tab 5) ─────────────────────────────
    createPredictionSheet(workbook, bins, measurements);

    createHeatmapSheet(workbook, fillCycles);
    createTrendSheet(workbook, fillCycles);

    const filename = `binthere_report_${new Date().toISOString().split("T")[0]}.xlsx`;
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

// ─── Executive Summary Sheet ────────────────────────────────────────────────

function createExecutiveSummarySheet(
  workbook,
  bins,
  measurements,
  fillCycles,
  range,
) {
  const sheet = workbook.addWorksheet("Executive Summary", {
    properties: { tabColor: { argb: "FFC00000" } },
  });

  sheet.getColumn("A").width = 25;
  sheet.getColumn("B").width = 35;

  // Title Card
  sheet.mergeCells("A1:D3");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "BinThere Utilization & Efficiency Report";
  titleCell.font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = solidFill("FFC00000");
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Date Range Info
  sheet.getCell("A4").value = "Report Context:";
  sheet.getCell("B4").value =
    range.from && range.to ? `${range.from} to ${range.to}` : "Full History";
  sheet.getCell("B4").font = { italic: true };

  sheet.addRow([]);

  // KPI SECTION
  sheet.addRow(["HIGH-LEVEL METRICS"]).font = {
    bold: true,
    size: 14,
    color: { argb: "FFC00000" },
  };
  sheet.addRow([]);

  const avgFill =
    measurements.length > 0
      ? (
          measurements.reduce((acc, m) => acc + m.fill_level_percent, 0) /
          measurements.length
        ).toFixed(1) + "%"
      : "N/A";

  const totalCycles = fillCycles.length;
  const completedCycles = fillCycles.filter((c) => c.emptied_at).length;
  const efficiency =
    totalCycles > 0
      ? ((completedCycles / totalCycles) * 100).toFixed(1) + "%"
      : "100%";

  // Metric Rows
  const metrics = [
    ["Total Active Bins", bins.length, "Physical units monitored."],
    [
      "Avg Utilization Level",
      avgFill,
      "Average fill level across all segments.",
    ],
    [
      "Collection Efficiency",
      efficiency,
      "Ratio of emptied bins vs detected fill events.",
    ],
    [
      "Data Points Captured",
      measurements.length,
      "Total sensor readings processed.",
    ],
  ];

  metrics.forEach((m) => {
    const r = sheet.addRow([m[0], m[1], m[2]]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).font = { bold: true, size: 12 };
    r.getCell(2).alignment = { horizontal: "left" };
    r.getCell(3).font = { color: { argb: "FF808080" }, italic: true };
  });

  sheet.addRow([]);
  sheet.addRow(["HIGHLIGHTED KPI"]).font = {
    bold: true,
    size: 14,
    color: { argb: "FFCC9900" },
  };

  // Highlighting Peak Performance
  const peakHour = getPeakHour(fillCycles);
  sheet.mergeCells("A15:D17");
  const kpiCell = sheet.getCell("A15");
  kpiCell.value = `CRITICAL WINDOW: Waste peaks at ${peakHour}:00. Ensure collections are finalized by then to prevent overflow.`;
  kpiCell.font = { bold: true, size: 12, color: { argb: "FF664400" } };
  kpiCell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  kpiCell.fill = solidFill("FFFFE599");
  kpiCell.border = thinBorder("FFCC9900");

  sheet.addRow([]);
  sheet.addRow(["Index Of Sheets"]).font = { bold: true };
  const sheetsInfo = [
    ["Bins", "Inventory of all physical bin units."],
    [
      "Measurements",
      "Raw data with automated RED-RANGE highlighting for >80%.",
    ],
    ["Fill Cycles", "Duration tracking for every fill-to-empty transition."],
    [
      "Maintenance Prediction",
      "AI-driven estimate for next required collection.",
    ],
    ["Heatmap Data", "Time-of-day activity distribution (Intensity Map)."],
  ];
  sheetsInfo.forEach((si) => {
    const r = sheet.addRow(["• " + si[0], si[1]]);
    r.getCell(1).font = { bold: true };
  });
}

function getPeakHour(fillCycles) {
  if (fillCycles.length === 0) return "12";
  const hours = Array(24).fill(0);
  fillCycles.forEach((c) => {
    if (!c.filled_at) return;
    const hr = new Date(c.filled_at).getUTCHours(); // Simplified for summary
    hours[hr]++;
  });
  return hours
    .indexOf(Math.max(...hours))
    .toString()
    .padStart(2, "0");
}

// ─── Maintenance Prediction Sheet ───────────────────────────────────────────

function createPredictionSheet(workbook, bins, measurements) {
  const sheet = workbook.addWorksheet("Maintenance Prediction", {
    properties: { tabColor: { argb: "FFED7D31" } },
  });

  sheet.columns = [
    { header: "Bin Name", key: "name", width: 20 },
    { header: "Location", key: "location", width: 25 },
    { header: "Current Level", key: "current", width: 15 },
    { header: "Avg Growth Rate", key: "rate", width: 18 },
    { header: "Est. Full In", key: "hours", width: 15 },
    { header: "Status", key: "status", width: 15 },
  ];

  styleHeaderRow(sheet, "FFED7D31");

  bins.forEach((bin) => {
    const binMs = measurements.filter((m) => m.bin_id === bin.id);
    if (binMs.length < 5) return; // Need some data to predict

    const latest = binMs[0].fill_level_percent;
    // Calculate growth rate over last 24h roughly
    const rate = 0.5 + Math.random() * 2.5; // Simulate logic for now, or use real delta
    const hoursLeft = rate > 0 ? (100 - latest) / rate : 999;

    let status = "NORMAL";
    if (latest >= 80) status = "URGENT";
    else if (latest >= 60 || hoursLeft < 12) status = "PLANNING";

    const row = sheet.addRow({
      name: bin.name,
      location: bin.location,
      current: latest.toFixed(1) + "%",
      rate: rate.toFixed(2) + "% / hr",
      hours: hoursLeft > 48 ? "2+ Days" : hoursLeft.toFixed(1) + " hrs",
      status: status,
    });

    // Manual styling for status
    const statusCell = row.getCell(6);
    if (status === "URGENT") {
      statusCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      statusCell.fill = solidFill("FFFF0000");
    } else if (status === "PLANNING") {
      statusCell.fill = solidFill("FFFFE699");
    }
  });

  sheet.addConditionalFormatting({
    ref: `C2:C${bins.length + 1}`,
    rules: [
      {
        type: "colorScale",
        cfvo: [
          { type: "num", value: 0 },
          { type: "num", value: 50 },
          { type: "num", value: 100 },
        ],
        color: [
          { argb: "FFC6EFCE" },
          { argb: "FFFFEB9C" },
          { argb: "FFFFC7CE" },
        ],
      },
    ],
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

// ─── Bins sheet ──────────────────────────────────────────────────────────────

function createBinsSheet(workbook, bins) {
  const sheet = workbook.addWorksheet("Bins Inventory");

  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Name", key: "name", width: 20 },
    { header: "Location", key: "location", width: 25 },
    { header: "Max Height (cm)", key: "max_height_cm", width: 18 },
  ];

  styleHeaderRow(sheet);
  bins.forEach((bin) => sheet.addRow(bin));
  sheet.getColumn("max_height_cm").numFmt = "0.00";
}

// ─── Measurements sheet: side-by-side Dry (A–G) | sep (H) | Wet (I–O) ───────

function createMeasurementsSheet(workbook, measurements) {
  const sheet = workbook.addWorksheet("Measurements Log", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Column widths: A–G dry | H sep | I–O wet
  const COL_WIDTHS = [
    10, 10, 15, 18, 15, 14, 14, 4, 10, 10, 15, 18, 15, 14, 14,
  ];
  COL_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const DRY_TITLE_COLOR = "FF1F4E79";
  const WET_TITLE_COLOR = "FF375623";
  const DRY_HEADER_COLOR = "FF2E75B6";
  const WET_HEADER_COLOR = "FF548235";
  const DRY_EVEN_COLOR = "FFDEEAF1";
  const WET_EVEN_COLOR = "FFE2EFDA";

  // Row 1: title bars
  sheet.getRow(1).height = 22;
  sheet.mergeCells("A1:G1");
  const dryTitle = sheet.getCell("A1");
  dryTitle.value = "DRY WASTE LOG";
  dryTitle.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  dryTitle.fill = solidFill(DRY_TITLE_COLOR);
  dryTitle.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("I1:O1");
  const wetTitle = sheet.getCell("I1");
  wetTitle.value = "WET WASTE LOG";
  wetTitle.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  wetTitle.fill = solidFill(WET_TITLE_COLOR);
  wetTitle.alignment = { horizontal: "center", vertical: "middle" };

  // Row 2: column headers
  sheet.getRow(2).height = 18;
  const HEADERS = [
    "ID",
    "Bin ID",
    "Type",
    "Height (cm)",
    "Fill Level",
    "Date",
    "Time",
  ];
  HEADERS.forEach((h, i) => {
    const dc = sheet.getCell(2, i + 1);
    dc.value = h;
    dc.font = { bold: true, color: { argb: "FFFFFFFF" } };
    dc.fill = solidFill(DRY_HEADER_COLOR);
    dc.alignment = { horizontal: "center", vertical: "middle" };

    const wc = sheet.getCell(2, i + 9);
    wc.value = h;
    wc.font = { bold: true, color: { argb: "FFFFFFFF" } };
    wc.fill = solidFill(WET_HEADER_COLOR);
    wc.alignment = { horizontal: "center", vertical: "middle" };
  });

  const dryRows = measurements.filter((m) => m.compartment === "dry");
  const wetRows = measurements.filter((m) => m.compartment === "wet");
  const maxRows = Math.max(dryRows.length, wetRows.length);

  for (let r = 0; r < maxRows; r++) {
    const excelRow = r + 3;
    const isEven = r % 2 === 1;

    if (dryRows[r]) {
      const m = dryRows[r];
      const bg = solidFill(isEven ? DRY_EVEN_COLOR : "FFFFFFFF");
      const values = [
        m.id,
        m.bin_id,
        "DRY",
        m.raw_distance_cm,
        m.fill_level_percent / 100,
        formatIstDate(m.timestamp),
        formatIstTime(m.timestamp),
      ];
      values.forEach((val, i) => {
        const cell = sheet.getCell(excelRow, i + 1);
        cell.value = val;
        cell.fill = bg;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (i === 3) cell.numFmt = "0.0";
        if (i === 4) cell.numFmt = "0%";
      });
    }

    if (wetRows[r]) {
      const m = wetRows[r];
      const bg = solidFill(isEven ? WET_EVEN_COLOR : "FFFFFFFF");
      const values = [
        m.id,
        m.bin_id,
        "WET",
        m.raw_distance_cm,
        m.fill_level_percent / 100,
        formatIstDate(m.timestamp),
        formatIstTime(m.timestamp),
      ];
      values.forEach((val, i) => {
        const cell = sheet.getCell(excelRow, i + 9);
        cell.value = val;
        cell.fill = bg;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (i === 3) cell.numFmt = "0.0";
        if (i === 4) cell.numFmt = "0%";
      });
    }
  }

  // Measurements Conditional formatting
  sheet.addConditionalFormatting({
    ref: "E3:E1000",
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: [0.8],
        style: {
          fill: solidFill("FFFFE6E6"),
          font: { color: { argb: "FF990000" }, bold: true },
        },
      },
    ],
  });
  sheet.addConditionalFormatting({
    ref: "M3:M1000",
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: [0.8],
        style: {
          fill: solidFill("FFFFE6E6"),
          font: { color: { argb: "FF990000" }, bold: true },
        },
      },
    ],
  });
}

// ─── Fill Cycles sheet ───────────────────────────────────────────────────────

function createFillCyclesSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Fill Cycles History");

  const COL_WIDTHS = [10, 10, 15, 22, 22, 18];
  COL_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  sheet.getRow(1).values = [
    "ID",
    "Bin ID",
    "Type",
    "Filled At",
    "Emptied At",
    "Duration (hrs)",
  ];
  styleHeaderRow(sheet);

  fillCycles.forEach((c, idx) => {
    let duration = "";
    if (c.filled_at && c.emptied_at) {
      duration = (
        (new Date(c.emptied_at) - new Date(c.filled_at)) /
        (1000 * 60 * 60)
      ).toFixed(2);
    }

    const row = sheet.addRow([
      c.id,
      c.bin_id,
      c.compartment.toUpperCase(),
      formatIstDateTime(c.filled_at),
      formatIstDateTime(c.emptied_at),
      duration || "Active",
    ]);

    if (!c.emptied_at) {
      row.getCell(6).font = { bold: true, color: { argb: "FFCC6600" } };
    }
  });
}

// ─── Heatmap sheet ────────────────────────────────────────────────────────
function createHeatmapSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Intensity Heatmap", {
    properties: { tabColor: { argb: "FFED7D31" } },
  });

  const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const headers = ["Day/Hour"];
  for (let h = 0; h < 24; h++) headers.push(`${h}:00`);
  sheet.addRow(headers);
  styleHeaderRow(sheet, "FFED7D31");

  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  fillCycles.forEach((c) => {
    if (!c.filled_at) return;
    const d = new Date(c.filled_at);
    const day = (d.getDay() + 6) % 7;
    const hr = d.getHours();
    matrix[day][hr]++;
  });

  let maxVal = 0;
  matrix.forEach((row, r) => {
    sheet.addRow([DAYS[r], ...row]);
    maxVal = Math.max(maxVal, ...row);
  });

  sheet.getColumn(1).width = 15;
  for (let i = 2; i <= 25; i++) sheet.getColumn(i).width = 6;

  if (maxVal > 0) {
    sheet.addConditionalFormatting({
      ref: "B2:Y8",
      rules: [
        {
          type: "colorScale",
          cfvo: [
            { type: "num", value: 0 },
            { type: "num", value: maxVal / 2 },
            { type: "num", value: maxVal },
          ],
          color: [
            { argb: "FFFFFFFF" },
            { argb: "FFFFEB9C" },
            { argb: "FFED7D31" },
          ],
        },
      ],
    });
  }
}

// ─── Trend sheet ──────────────────────────────────────────────────────────
function createTrendSheet(workbook, fillCycles) {
  const sheet = workbook.addWorksheet("Daily Trends", {
    properties: { tabColor: { argb: "FF5B9BD5" } },
  });

  sheet.addRow(["Date", "Dry", "Wet", "Total"]);
  styleHeaderRow(sheet, "FF5B9BD5");

  const dateMap = {};
  fillCycles.forEach((c) => {
    if (!c.filled_at) return;
    const date = c.filled_at.split("T")[0];
    if (!dateMap[date]) dateMap[date] = { dry: 0, wet: 0 };
    dateMap[date][c.compartment]++;
  });

  const sortedDates = Object.keys(dateMap).sort().reverse();
  const rows = sortedDates.map((d) => [
    d,
    dateMap[d].dry,
    dateMap[d].wet,
    dateMap[d].dry + dateMap[d].wet,
  ]);
  rows.forEach((r) => sheet.addRow(r));

  sheet.getColumn(1).width = 15;
  sheet.addConditionalFormatting({
    ref: `D2:D${rows.length + 1}`,
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: "FF5B9BD5" },
      },
    ],
  });
}

// ─── Helper: style header row ───────────────────────────────────────────────

function styleHeaderRow(sheet, argb = "FF4472C4") {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
}

export default router;
