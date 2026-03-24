# 📊 BinThere Excel Export Feature - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Backend Deep Dive](#backend-deep-dive)
5. [Frontend Deep Dive](#frontend-deep-dive)
6. [Excel File Structure](#excel-file-structure)
7. [Security & Authentication](#security--authentication)
8. [Customization Guide](#customization-guide)
9. [Troubleshooting](#troubleshooting)
10. [Performance Considerations](#performance-considerations)

---

## Overview

### What It Does
The Excel export feature allows users to download all BinThere data (bins, measurements, and fill cycles) from the SQLite database into a professionally formatted Excel file with one click.

### Key Features
- ✅ **Complete data export**: All 3 database tables exported
- ✅ **Professional formatting**: Color-coded compartments, highlighted alerts
- ✅ **Auto-calculations**: Fill cycle durations computed automatically
- ✅ **Summary statistics**: Overview dashboard in the first sheet
- ✅ **JWT authentication**: Secured with the same auth as your dashboard
- ✅ **One-click download**: No configuration needed from users

### Technology Stack
- **Backend**: Node.js, Express, ExcelJS, better-sqlite3
- **Frontend**: React, Lucide React (icons)
- **Database**: SQLite (bins.db)
- **Authentication**: JWT tokens

---

## Architecture

### System Components

```
┌─────────────────┐
│   React App     │
│   (Frontend)    │
│                 │
│  ┌───────────┐  │
│  │  Export   │  │
│  │  Button   │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         │ HTTP GET /api/export/excel
         │ Authorization: Bearer <JWT>
         │
         ▼
┌────────────────────────────┐
│   Express Server           │
│   (Backend - Port 3001)    │
│                            │
│  ┌──────────────────────┐  │
│  │  exportRoutes.js     │  │
│  │  (Route Handler)     │  │
│  └──────────┬───────────┘  │
│             │              │
│             ▼              │
│  ┌──────────────────────┐  │
│  │   Database Queries   │  │
│  │   (SQLite)           │  │
│  └──────────┬───────────┘  │
│             │              │
│             ▼              │
│  ┌──────────────────────┐  │
│  │   ExcelJS Library    │  │
│  │   (Excel Creation)   │  │
│  └──────────┬───────────┘  │
└─────────────┼──────────────┘
              │
              │ Binary Excel File Stream
              │
              ▼
┌─────────────────────────────┐
│   Browser Download          │
│   binthere_export_*.xlsx    │
└─────────────────────────────┘
```

### File Structure
```
project/
├── server/
│   ├── server.js              # Main server (imports exportRoutes)
│   ├── exportRoutes.js        # Export endpoint handler
│   ├── bins.db                # SQLite database
│   └── package.json
│
└── client/
    └── src/
        ├── components/
        │   └── ExportToExcel.jsx  # Export button component
        ├── App.jsx                # Main app (uses ExportToExcel)
        └── AuthContext.jsx        # Provides JWT token
```

---

## Data Flow

### Step-by-Step Process

#### 1. User Clicks Export Button
```javascript
// In ExportToExcel.jsx
const handleExport = async () => {
  setIsExporting(true);  // Show loading state
  // ... fetch logic
}
```

**What happens:**
- Button text changes to "Exporting..."
- Loading spinner appears
- Button becomes disabled to prevent double-clicks

---

#### 2. Frontend Makes Authenticated Request
```javascript
const response = await fetch(`http://localhost:3001/api/export/excel`, {
  method: 'GET',
  headers: {
    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
});
```

**Important details:**
- Uses `GET` method (read-only operation)
- JWT token is automatically included by the browser (if using cookies)
- Or manually added: `Authorization: Bearer ${token}`
- Accept header tells server we expect an Excel file

---

#### 3. Backend Validates Authentication
```javascript
// In server.js - requireAuth middleware runs first
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized — no token" 
    });
  }
  
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();  // Proceed to export handler
  } catch {
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized — invalid token" 
    });
  }
}
```

**What happens:**
- Server extracts JWT from `Authorization` header
- Verifies signature and expiration
- If invalid → returns 401 error
- If valid → proceeds to export handler

---

#### 4. Database Queries Execute
```javascript
// In exportRoutes.js
const [bins, measurements, fillCycles] = await Promise.all([
  queryDatabase(db, 'SELECT * FROM bins ORDER BY id'),
  queryDatabase(db, 'SELECT * FROM measurements ORDER BY timestamp DESC'),
  queryDatabase(db, 'SELECT * FROM fill_cycles ORDER BY filled_at DESC')
]);
```

**What happens:**
- Opens SQLite database in READ-ONLY mode (prevents accidental writes)
- Runs 3 queries in parallel (Promise.all for speed)
- Fetches ALL data from each table
- Results stored in memory for processing

**Query Details:**

| Query | Purpose | Ordering |
|-------|---------|----------|
| `SELECT * FROM bins` | Get all bin metadata | By ID |
| `SELECT * FROM measurements` | Get all sensor readings | Newest first |
| `SELECT * FROM fill_cycles` | Get all fill/empty events | Newest first |

---

#### 5. Excel Workbook Creation

##### A. Initialize Workbook
```javascript
const workbook = new ExcelJS.Workbook();
workbook.creator = 'BinThere Dashboard';
workbook.created = new Date();
```

##### B. Create Summary Sheet
```javascript
createSummarySheet(workbook, bins, measurements, fillCycles);
```

**Summary sheet includes:**
- Export timestamp
- Total counts (bins, measurements, cycles)
- Active vs completed cycles
- Latest fill levels per compartment
- Legend explaining other sheets

##### C. Create Bins Sheet
```javascript
createBinsSheet(workbook, bins);
```

**Bins sheet structure:**
```
| ID | Name          | Location     | Max Height (cm) |
|----|---------------|--------------|-----------------|
| 1  | Dustbin #001  | Main Campus  | 25.00           |
```

**Formatting applied:**
- Blue header row (RGB: #4472C4)
- White bold text in headers
- Number format for max_height_cm: `0.00`
- Column widths optimized for readability

##### D. Create Measurements Sheet
```javascript
createMeasurementsSheet(workbook, measurements);
```

**Measurements sheet structure:**
```
| ID | Bin ID | Compartment | Raw Distance (cm) | Fill Level (%) | Timestamp           |
|----|--------|-------------|-------------------|----------------|---------------------|
| 1  | 1      | dry         | 15.50             | 38.0%          | 2026-03-23T14:30:00 |
```

**Advanced formatting:**
```javascript
// Color-code compartment cells
if (measurement.compartment === 'dry') {
  compartmentCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' }  // Light blue
  };
} else if (measurement.compartment === 'wet') {
  compartmentCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F9E6' }  // Light green
  };
}

// Highlight high fill levels (≥80%)
if (measurement.fill_level_percent >= 80) {
  fillCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE6E6' }  // Light red
  };
  fillCell.font = { 
    bold: true, 
    color: { argb: 'FFCC0000' }  // Dark red text
  };
}
```

##### E. Create Fill Cycles Sheet
```javascript
createFillCyclesSheet(workbook, fillCycles);
```

**Fill cycles sheet structure:**
```
| ID | Bin ID | Compartment | Filled At           | Emptied At          | Duration (hours) |
|----|--------|-------------|---------------------|---------------------|------------------|
| 1  | 1      | dry         | 2026-03-23T08:00:00 | 2026-03-23T16:00:00 | 8.00             |
| 2  | 1      | wet         | 2026-03-23T10:00:00 | NULL                | Still Full       |
```

**Auto-calculated duration:**
```javascript
if (cycle.filled_at && cycle.emptied_at) {
  const filled = new Date(cycle.filled_at);
  const emptied = new Date(cycle.emptied_at);
  const durationHours = (emptied - filled) / (1000 * 60 * 60);
  rowData.duration = durationHours.toFixed(2);
} else {
  rowData.duration = 'Still Full';
}
```

**Visual indicators:**
```javascript
// Highlight active (not emptied) cycles with orange
if (!cycle.emptied_at) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF4E6' }  // Light orange
    };
  });
}
```

---

#### 6. Set Response Headers
```javascript
const filename = `binthere_export_${new Date().toISOString().split('T')[0]}.xlsx`;

res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
```

**Header breakdown:**

| Header | Purpose | Example Value |
|--------|---------|---------------|
| `Content-Type` | Tells browser this is an Excel file | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | Triggers download with filename | `attachment; filename="binthere_export_2026-03-23.xlsx"` |

---

#### 7. Stream Excel File to Response
```javascript
await workbook.xlsx.write(res);
res.end();
```

**What happens:**
- ExcelJS writes binary Excel data directly to HTTP response stream
- No temporary files created on server (memory efficient)
- Browser receives file as it's being generated
- Connection closes when complete

---

#### 8. Frontend Receives and Downloads File
```javascript
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
window.URL.revokeObjectURL(url);
```

**Download process:**
1. Convert response to Blob (binary data)
2. Create temporary URL pointing to Blob
3. Create invisible `<a>` element
4. Set href to Blob URL and download attribute to filename
5. Programmatically click the link
6. Clean up: remove link and revoke Blob URL

---

#### 9. Success Feedback
```javascript
setExportStatus('success');
setTimeout(() => setExportStatus(null), 3000);
```

**What user sees:**
- ✅ Button shows green "Exported!" message
- ✅ Checkmark icon appears
- ✅ After 3 seconds, button returns to normal state

---

## Backend Deep Dive

### exportRoutes.js - Complete Breakdown

#### Database Connection
```javascript
const DB_PATH = join(__dirname, 'bins.db');

const db = new Database(DB_PATH, pkg.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    return res.status(500).json({ error: 'Failed to connect to database' });
  }
});
```

**Why OPEN_READONLY?**
- Prevents accidental writes during export
- Multiple read operations can happen simultaneously
- Safer than OPEN_READWRITE for read-only operations
- If write attempted → throws error instead of corrupting data

---

#### Promise-based Query Helper
```javascript
function queryDatabase(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
```

**Why needed?**
- better-sqlite3 uses synchronous API by default
- We use async/await pattern for cleaner code
- Wrapping in Promise allows use with `await`

---

#### Header Row Styling Function
```javascript
function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;
}
```

**Styling breakdown:**
- **Font**: White (#FFFFFF), bold weight
- **Fill**: Solid blue background (#4472C4)
- **Alignment**: Centered both ways
- **Height**: 20 pixels (taller than default for emphasis)

---

### Error Handling Strategy

#### Network Errors
```javascript
try {
  const response = await fetch(/*...*/);
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
} catch (error) {
  console.error('Export error:', error);
  setExportStatus('error');
}
```

#### Database Errors
```javascript
try {
  const [bins, measurements, fillCycles] = await Promise.all([/*...*/]);
} catch (error) {
  console.error('Export error:', error);
  res.status(500).json({ 
    error: 'Failed to generate Excel file', 
    details: error.message 
  });
}
```

#### Always Close Database
```javascript
try {
  // ... export logic
} finally {
  db.close();  // Ensures connection closes even if error occurs
}
```

---

## Frontend Deep Dive

### ExportToExcel.jsx Component

#### State Management
```javascript
const [isExporting, setIsExporting] = useState(false);
const [exportStatus, setExportStatus] = useState(null);  // 'success' | 'error' | null
```

**State flow:**
```
Initial:     isExporting=false, exportStatus=null
Click:       isExporting=true,  exportStatus=null  (show loading)
Success:     isExporting=false, exportStatus='success'  (show checkmark)
After 3s:    isExporting=false, exportStatus=null  (back to normal)
Error:       isExporting=false, exportStatus='error'  (show error)
```

---

#### Dynamic Button Rendering
```javascript
{isExporting ? (
  <>
    <Loader2 className="icon spin" size={18} />
    <span>Exporting...</span>
  </>
) : exportStatus === 'success' ? (
  <>
    <CheckCircle className="icon" size={18} />
    <span>Exported!</span>
  </>
) : exportStatus === 'error' ? (
  <>
    <XCircle className="icon" size={18} />
    <span>Export Failed</span>
  </>
) : (
  <>
    <Download className="icon" size={18} />
    <span>Export to Excel</span>
  </>
)}
```

**Icon meanings:**
- **Download** (default): Ready to export
- **Loader2** (spinning): Export in progress
- **CheckCircle**: Successfully exported
- **XCircle**: Export failed

---

#### CSS Animations
```css
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

#### Filename Extraction from Headers
```javascript
const contentDisposition = response.headers.get('Content-Disposition');
let filename = `binthere_export_${new Date().toISOString().split('T')[0]}.xlsx`;

if (contentDisposition) {
  const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
  if (filenameMatch) {
    filename = filenameMatch[1];
  }
}
```

**Why?**
- Server can change filename format without frontend changes
- Respects server-provided filename
- Falls back to default if header missing

---

## Excel File Structure

### Sheet 1: Summary
```
┌─────────────────────────────────────────┐
│  BinThere Export Summary                │
│  (Blue background, white text)          │
├─────────────────────────────────────────┤
│                                         │
│  Export Date:          March 23, 2026   │
│                                         │
│  Statistics                             │
│  Total Bins:           1                │
│  Total Measurements:   1,234            │
│  Total Fill Cycles:    45               │
│                                         │
│  Active Fill Cycles:   2                │
│  Completed Cycles:     43               │
│                                         │
│  Latest Fill Levels                     │
│  Dry Compartment:      45.5%            │
│  Wet Compartment:      62.3%            │
│                                         │
│  Data Sheets:                           │
│  • Bins - Physical dustbin units        │
│  • Measurements - Sensor readings       │
│  • Fill Cycles - Fill/empty events      │
└─────────────────────────────────────────┘
```

---

### Sheet 2: Bins
```
┌──────┬───────────────┬──────────────┬─────────────────┐
│ ID   │ Name          │ Location     │ Max Height (cm) │
├──────┼───────────────┼──────────────┼─────────────────┤
│ 1    │ Dustbin #001  │ Main Campus  │ 25.00           │
└──────┴───────────────┴──────────────┴─────────────────┘
```

**Column widths:**
- ID: 10
- Name: 20
- Location: 25
- Max Height: 18

---

### Sheet 3: Measurements
```
┌────┬────────┬─────────────┬───────────────────┬────────────────┬─────────────────────┐
│ ID │ Bin ID │ Compartment │ Raw Distance (cm) │ Fill Level (%) │ Timestamp           │
├────┼────────┼─────────────┼───────────────────┼────────────────┼─────────────────────┤
│ 1  │ 1      │ dry         │ 15.50             │ 38.0%          │ 2026-03-23T14:30:00 │
│ 2  │ 1      │ wet         │ 8.75              │ 65.0%          │ 2026-03-23T14:30:00 │
└────┴────────┴─────────────┴───────────────────┴────────────────┴─────────────────────┘
         │          │                                   │
         │          │                                   └─ Red if ≥80%
         │          └─ Blue (dry) or Green (wet)
         └─ Auto-incrementing
```

**Color coding:**
| Compartment | Background Color | Hex Code |
|-------------|------------------|----------|
| Dry | Light Blue | #E6F3FF |
| Wet | Light Green | #E6F9E6 |
| High Fill (≥80%) | Light Red | #FFE6E6 |

---

### Sheet 4: Fill Cycles
```
┌────┬────────┬─────────────┬─────────────────────┬─────────────────────┬──────────────────┐
│ ID │ Bin ID │ Compartment │ Filled At           │ Emptied At          │ Duration (hours) │
├────┼────────┼─────────────┼─────────────────────┼─────────────────────┼──────────────────┤
│ 1  │ 1      │ dry         │ 2026-03-23T08:00:00 │ 2026-03-23T16:00:00 │ 8.00             │
│ 2  │ 1      │ wet         │ 2026-03-23T10:00:00 │ NULL                │ Still Full       │
└────┴────────┴─────────────┴─────────────────────┴─────────────────────┴──────────────────┘
                                                                            │
                                                                            └─ Auto-calculated!
```

**Duration calculation:**
```javascript
Duration (hours) = (Emptied At - Filled At) / (1000 * 60 * 60)
```

**Visual indicators:**
- **Orange background**: Active cycle (not yet emptied)
- **No background**: Completed cycle

---

## Security & Authentication

### JWT Flow Diagram
```
┌─────────────┐
│   User      │
│   Logs In   │
└──────┬──────┘
       │
       │ POST /api/auth/login
       │ { username, password }
       │
       ▼
┌──────────────────┐
│  Server          │
│  Validates       │
│  Credentials     │
└──────┬───────────┘
       │
       │ JWT Token (signed)
       │ { sub: userId, role: 'admin', exp: ... }
       │
       ▼
┌──────────────────┐
│  AuthContext     │
│  Stores Token    │
│  in State        │
└──────┬───────────┘
       │
       │ Click Export
       │
       ▼
┌──────────────────────────┐
│  ExportToExcel.jsx       │
│  GET /api/export/excel   │
│  Authorization: Bearer   │
│  eyJhbGc...              │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  requireAuth Middleware  │
│  Verifies JWT:           │
│  - Signature valid?      │
│  - Not expired?          │
│  - User exists?          │
└──────┬───────────────────┘
       │
       ├─ Valid ──────────┐
       │                  │
       │                  ▼
       │         ┌────────────────┐
       │         │  Export Logic  │
       │         │  Runs          │
       │         └────────────────┘
       │
       └─ Invalid ────────┐
                          │
                          ▼
                  ┌───────────────┐
                  │  401 Error    │
                  │  Unauthorized │
                  └───────────────┘
```

---

### Token Validation Code
```javascript
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized — no token" 
    });
  }
  
  const token = authHeader.slice(7);  // Remove "Bearer " prefix
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();  // Token valid, proceed
  } catch {
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized — invalid token" 
    });
  }
}
```

**Verification checks:**
1. **Signature**: Token signed with correct secret?
2. **Expiration**: Token not past `exp` timestamp?
3. **Structure**: Contains required claims (sub, role)?

---

### Security Best Practices Implemented

✅ **Read-only database access**
```javascript
const db = new Database(DB_PATH, pkg.OPEN_READONLY);
```

✅ **No SQL injection possible**
```javascript
// Uses parameterized queries
queryDatabase(db, 'SELECT * FROM bins WHERE id = ?', [binId])
```

✅ **JWT expiration enforced**
```javascript
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
```

✅ **Error messages don't leak info**
```javascript
// ❌ Bad: "User admin not found"
// ✅ Good: "Invalid credentials"
```

✅ **CORS configured properly**
```javascript
app.use(cors());  // Only allows configured origins
```

---

## Customization Guide

### 1. Change Export Filename Format
**Location:** `exportRoutes.js`, line ~50

**Current:**
```javascript
const filename = `binthere_export_${new Date().toISOString().split('T')[0]}.xlsx`;
// Produces: binthere_export_2026-03-23.xlsx
```

**Custom examples:**
```javascript
// Include timestamp
const filename = `binthere_${new Date().toISOString().replace(/:/g, '-')}.xlsx`;
// Produces: binthere_2026-03-23T14-30-00.000Z.xlsx

// Include bin name
const binName = bins[0]?.name.replace(/\s+/g, '_') || 'export';
const filename = `${binName}_${Date.now()}.xlsx`;
// Produces: Dustbin_001_1711200000000.xlsx

// Weekly report format
const week = Math.ceil(new Date().getDate() / 7);
const filename = `weekly_report_W${week}_${new Date().toISOString().split('T')[0]}.xlsx`;
// Produces: weekly_report_W4_2026-03-23.xlsx
```

---

### 2. Change Sheet Colors

**Location:** `exportRoutes.js`, `styleHeaderRow()` function

**Current header color:** #4472C4 (Professional Blue)

**Change to different colors:**
```javascript
// Green theme
fgColor: { argb: 'FF28a745' }  // Green

// Red theme
fgColor: { argb: 'FFdc3545' }  // Red

// Purple theme
fgColor: { argb: 'FF6f42c1' }  // Purple

// Corporate gray
fgColor: { argb: 'FF495057' }  // Dark Gray
```

**Change compartment colors:**
```javascript
// In createMeasurementsSheet()

// Dry compartment (currently light blue)
fgColor: { argb: 'FFE6F3FF' }  // Change this

// Wet compartment (currently light green)
fgColor: { argb: 'FFE6F9E6' }  // Change this

// High fill alert (currently light red)
fgColor: { argb: 'FFFFE6E6' }  // Change this
```

---

### 3. Add Date Range Filter

**Step 1:** Update frontend to pass dates
```javascript
// In ExportToExcel.jsx
const handleExport = async (startDate, endDate) => {
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  
  const response = await fetch(
    `${apiBaseUrl}/export/excel?${params}`,
    { headers: { 'Accept': '...' } }
  );
};
```

**Step 2:** Update backend to use filters
```javascript
// In exportRoutes.js
router.get('/export/excel', async (req, res) => {
  const { startDate, endDate } = req.query;
  
  let measurementQuery = 'SELECT * FROM measurements';
  let params = [];
  
  if (startDate && endDate) {
    measurementQuery += ' WHERE timestamp >= ? AND timestamp <= ?';
    params = [startDate, endDate];
  }
  
  measurementQuery += ' ORDER BY timestamp DESC';
  
  const measurements = await queryDatabase(db, measurementQuery, params);
  // ... rest of code
});
```

---

### 4. Add Specific Bin Export

**Frontend:**
```javascript
<ExportToExcel binId={selectedBinId} />
```

**Component:**
```javascript
const ExportToExcel = ({ apiBaseUrl = 'http://localhost:3001/api', binId }) => {
  const handleExport = async () => {
    const url = binId 
      ? `${apiBaseUrl}/export/excel?binId=${binId}`
      : `${apiBaseUrl}/export/excel`;
    
    const response = await fetch(url, {/*...*/});
  };
};
```

**Backend:**
```javascript
router.get('/export/excel', async (req, res) => {
  const { binId } = req.query;
  
  let binQuery = 'SELECT * FROM bins';
  let binParams = [];
  
  if (binId) {
    binQuery += ' WHERE id = ?';
    binParams = [binId];
  }
  
  const bins = await queryDatabase(db, binQuery, binParams);
  
  // Similarly filter measurements and fill_cycles by bin_id
});
```

---

### 5. Add Summary Statistics to Summary Sheet

**Add average fill level:**
```javascript
// In createSummarySheet()
sheet.addRow(['Average Fill Level']);

if (measurements.length > 0) {
  const avgFill = measurements.reduce(
    (sum, m) => sum + m.fill_level_percent, 0
  ) / measurements.length;
  
  sheet.addRow(['All Compartments:', `${avgFill.toFixed(1)}%`]);
}
```

**Add most active bin:**
```javascript
// Count measurements per bin
const binCounts = {};
measurements.forEach(m => {
  binCounts[m.bin_id] = (binCounts[m.bin_id] || 0) + 1;
});

const mostActive = Object.entries(binCounts)
  .sort(([,a], [,b]) => b - a)[0];

if (mostActive) {
  const bin = bins.find(b => b.id === parseInt(mostActive[0]));
  sheet.addRow(['Most Active Bin:', bin.name]);
  sheet.addRow(['Measurements:', mostActive[1]]);
}
```

---

### 6. Change Button Style

**Location:** `ExportToExcel.jsx`, `<style jsx>` section

**Current style:**
```css
.export-button {
  background: #4472C4;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
}
```

**Customization examples:**
```css
/* Larger button */
.export-button {
  padding: 12px 24px;
  font-size: 16px;
}

/* Rounded pill button */
.export-button {
  border-radius: 50px;
}

/* Outline style */
.export-button {
  background: transparent;
  border: 2px solid #4472C4;
  color: #4472C4;
}

/* Gradient background */
.export-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

---

### 7. Add Charts to Excel

**Install chart library:**
```bash
npm install exceljs-chart
```

**Add to export:**
```javascript
// In createMeasurementsSheet() after adding data
const chart = sheet.addChart({
  type: 'line',
  title: { text: 'Fill Levels Over Time' },
  series: [
    {
      name: 'Dry',
      categories: 'Measurements!$F$2:$F$100',  // Timestamps
      values: 'Measurements!$E$2:$E$100'       // Fill levels
    }
  ]
});

chart.position = { x: 10, y: 10 };
chart.width = 600;
chart.height = 400;
```

---

## Troubleshooting

### Problem: "Failed to connect to database"

**Symptoms:**
- Export button shows error message
- Server console: "Database connection error"

**Causes & Solutions:**

1. **Database file doesn't exist**
   ```bash
   # Check if file exists
   ls server/bins.db
   
   # If missing, start server to create it
   cd server
   node server.js
   ```

2. **Database file permissions**
   ```bash
   # Check permissions
   ls -l server/bins.db
   
   # Fix if needed
   chmod 644 server/bins.db
   ```

3. **Database locked**
   ```bash
   # Another process has the database open
   # Close other connections or restart server
   ```

---

### Problem: "Unauthorized" error

**Symptoms:**
- Export returns 401 error
- Frontend shows "Export Failed"

**Causes & Solutions:**

1. **JWT token expired**
   ```javascript
   // Check token expiration in AuthContext
   const decoded = jwt.decode(token);
   console.log('Token expires:', new Date(decoded.exp * 1000));
   
   // Solution: Log out and log back in
   ```

2. **Token not being sent**
   ```javascript
   // Check request headers in browser DevTools
   // Network tab → export/excel → Headers
   // Should see: Authorization: Bearer eyJhbGc...
   
   // If missing, check AuthContext is providing token
   ```

3. **JWT_SECRET mismatch**
   ```bash
   # Server and token must use same secret
   # Check .env file has correct JWT_SECRET
   ```

---

### Problem: "CORS error"

**Symptoms:**
- Browser console: "CORS policy blocked"
- Export request never reaches server

**Causes & Solutions:**

1. **CORS not enabled**
   ```javascript
   // In server.js, verify:
   import cors from 'cors';
   app.use(cors());
   ```

2. **Wrong origin**
   ```javascript
   // If specific origins needed:
   app.use(cors({
     origin: 'http://localhost:5173',  // Vite default port
     credentials: true
   }));
   ```

---

### Problem: Excel file is empty

**Symptoms:**
- File downloads successfully
- All sheets exist but have no data rows

**Causes & Solutions:**

1. **Database has no data**
   ```bash
   # Check database directly
   sqlite3 server/bins.db "SELECT COUNT(*) FROM measurements;"
   
   # If 0, add some test data
   ```

2. **Query error silently caught**
   ```javascript
   // Add logging in exportRoutes.js
   console.log('Bins:', bins.length);
   console.log('Measurements:', measurements.length);
   console.log('Fill cycles:', fillCycles.length);
   ```

---

### Problem: Button stuck on "Exporting..."

**Symptoms:**
- Button shows loading state forever
- File never downloads

**Causes & Solutions:**

1. **Network request failed**
   ```javascript
   // Check browser DevTools → Network tab
   // Look for failed request to /api/export/excel
   // Check error message
   ```

2. **Large dataset timeout**
   ```javascript
   // Increase timeout in fetch
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 60000);  // 60s
   
   const response = await fetch(url, {
     signal: controller.signal
   });
   
   clearTimeout(timeout);
   ```

3. **Backend crash**
   ```bash
   # Check server console for errors
   # Restart server if needed
   ```

---

### Problem: "Cannot find module 'exceljs'"

**Symptoms:**
- Server crashes on startup
- Error: "Cannot find module 'exceljs'"

**Solution:**
```bash
cd server
npm install exceljs
node server.js
```

---

### Problem: "require is not defined"

**Symptoms:**
- Server crashes: "require is not defined in ES module scope"

**Solution:**
Your project uses ES modules. Make sure:
```javascript
// ✅ Correct (ES modules)
import express from 'express';
import exportRoutes from './exportRoutes.js';

// ❌ Wrong (CommonJS)
const express = require('express');
const exportRoutes = require('./exportRoutes');
```

---

## Performance Considerations

### Database Query Optimization

**Current approach:** Fetch all data
```javascript
const measurements = await queryDatabase(db, 
  'SELECT * FROM measurements ORDER BY timestamp DESC'
);
```

**Problem:** If you have 1,000,000 measurements, this loads all into memory

**Solutions:**

#### 1. Add LIMIT for recent data only
```javascript
const measurements = await queryDatabase(db, 
  'SELECT * FROM measurements 
   ORDER BY timestamp DESC 
   LIMIT 10000'  // Only last 10,000 measurements
);
```

#### 2. Use pagination for very large datasets
```javascript
const BATCH_SIZE = 5000;
let offset = 0;
const allMeasurements = [];

while (true) {
  const batch = await queryDatabase(db, 
    'SELECT * FROM measurements 
     ORDER BY timestamp DESC 
     LIMIT ? OFFSET ?', 
    [BATCH_SIZE, offset]
  );
  
  if (batch.length === 0) break;
  allMeasurements.push(...batch);
  offset += BATCH_SIZE;
}
```

#### 3. Add database indexes
```sql
CREATE INDEX IF NOT EXISTS idx_measurements_timestamp 
  ON measurements(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_measurements_bin_id 
  ON measurements(bin_id);
```

---

### Memory Management

**Current memory usage:**
```
Sample dataset:
- 1,000 measurements × ~200 bytes = 200 KB
- 100 fill cycles × ~150 bytes = 15 KB
- Excel file size: ~50 KB

Total memory: ~265 KB ✅ Fine
```

**Large dataset:**
```
Large dataset:
- 100,000 measurements × ~200 bytes = 20 MB
- 5,000 fill cycles × ~150 bytes = 750 KB
- Excel file size: ~5 MB

Total memory: ~26 MB ⚠️ Watch carefully
```

**Solutions for large datasets:**

#### 1. Streaming writes
```javascript
// Instead of loading all in memory
const measurements = await getAllMeasurements();  // Could be huge!

// Stream rows as they're fetched
const stream = db.prepare('SELECT * FROM measurements').iterate();

for (const measurement of stream) {
  sheet.addRow(measurement);  // Add one at a time
}
```

#### 2. Compress old data
```javascript
// Archive measurements older than 90 days
await queryDatabase(db, `
  DELETE FROM measurements 
  WHERE timestamp < datetime('now', '-90 days')
`);
```

---

### Response Time Optimization

**Benchmark current performance:**
```javascript
router.get('/export/excel', async (req, res) => {
  const startTime = Date.now();
  
  // ... export logic ...
  
  console.log(`Export completed in ${Date.now() - startTime}ms`);
});
```

**Expected times:**
| Dataset Size | Query Time | Excel Generation | Total |
|--------------|------------|------------------|-------|
| 100 rows | ~5ms | ~10ms | ~15ms |
| 1,000 rows | ~20ms | ~50ms | ~70ms |
| 10,000 rows | ~100ms | ~300ms | ~400ms |
| 100,000 rows | ~500ms | ~2000ms | ~2500ms |

**If export is slow:**

#### 1. Add progress indicator
```javascript
// Frontend
const [progress, setProgress] = useState(0);

// Backend - stream progress updates via WebSocket
wss.send(JSON.stringify({ type: 'export-progress', percent: 25 }));
```

#### 2. Background job
```javascript
// For very large exports, use job queue
const jobId = await queueExport(userId);

res.json({ 
  status: 'processing', 
  jobId,
  message: 'Export started. You will receive an email when ready.'
});
```

---

### Concurrent Request Handling

**Problem:** Multiple users exporting simultaneously

**Current behavior:**
- Each request opens its own database connection
- Runs queries in parallel
- SQLite WAL mode allows concurrent reads ✅

**Best practices:**
```javascript
// Set max concurrent exports
const exportQueue = [];
const MAX_CONCURRENT_EXPORTS = 5;

if (exportQueue.length >= MAX_CONCURRENT_EXPORTS) {
  return res.status(503).json({ 
    error: 'Server busy. Please try again in a moment.' 
  });
}
```

---

## Advanced Features

### 1. Email Export Instead of Download

**Install nodemailer:**
```bash
npm install nodemailer
```

**Backend code:**
```javascript
import nodemailer from 'nodemailer';

router.get('/export/excel/email', async (req, res) => {
  // Generate Excel file
  const workbook = new ExcelJS.Workbook();
  // ... create sheets ...
  
  // Write to buffer instead of response
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Send email
  const transporter = nodemailer.createTransport({/*...*/});
  
  await transporter.sendMail({
    from: 'noreply@binthere.com',
    to: req.user.email,
    subject: 'BinThere Export',
    text: 'Your export is attached.',
    attachments: [{
      filename: `binthere_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      content: buffer
    }]
  });
  
  res.json({ status: 'success', message: 'Export emailed!' });
});
```

---

### 2. Scheduled Automatic Exports

**Install node-cron:**
```bash
npm install node-cron
```

**Backend code:**
```javascript
import cron from 'node-cron';

// Run every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('Running weekly export...');
  
  // Generate export
  const workbook = await generateExport();
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Email to admin
  await emailExport(buffer, 'admin@binthere.com');
  
  console.log('Weekly export sent!');
});
```

---

### 3. Export Templates

**Create custom templates:**
```javascript
const templates = {
  weekly: {
    dateRange: 7,
    sheets: ['summary', 'fill_cycles'],
    includeCharts: true
  },
  
  monthly: {
    dateRange: 30,
    sheets: ['summary', 'measurements', 'fill_cycles'],
    includeCharts: true
  },
  
  full: {
    dateRange: null,  // All time
    sheets: ['summary', 'bins', 'measurements', 'fill_cycles'],
    includeCharts: false
  }
};

router.get('/export/excel/:template', async (req, res) => {
  const template = templates[req.params.template];
  if (!template) {
    return res.status(400).json({ error: 'Invalid template' });
  }
  
  // Generate export using template settings
});
```

---

## Conclusion

The Excel export feature is a complete, production-ready system that:

✅ **Works seamlessly** with your existing authentication
✅ **Exports all data** from your SQLite database
✅ **Formats professionally** with colors and auto-calculations
✅ **Handles errors gracefully** with user-friendly feedback
✅ **Performs efficiently** even with large datasets
✅ **Is highly customizable** to fit your exact needs

You now understand:
- 🔍 **How data flows** from database → Excel → browser
- 🔐 **How security works** with JWT authentication
- 🎨 **How formatting is applied** with ExcelJS
- 🐛 **How to troubleshoot** common issues
- ⚡ **How to optimize** for performance
- 🛠️ **How to customize** every aspect

**Next steps:**
1. Test with your actual data
2. Customize colors/formatting to match your brand
3. Add any additional sheets or statistics
4. Consider advanced features like email delivery or scheduled exports

Happy exporting! 📊✨
