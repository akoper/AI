# Shipping Document & Invoice AI Extractor

An intelligent multimodal document processing system for the maritime, logistics, and shipping industry built with **Next.js**, **Google Gemini**, and a persistent **SQLite** database.

This application accepts PDF documents (Bills of Lading, Commercial Invoices, Freight Invoices, Packing Lists, Customs Declarations, etc.), analyzes the layout and multimodal text using Google Gemini, extracts critical domain-specific logistics fields, and automatically persists them into relational database tables (`shipping_documents`, `line_items`, and `container_details`).

---

## Features

- **Google Gemini Multimodal AI Integration**: Extracts structured shipping data from complex and unstructured logistics PDFs.
- **Dedicated Shipping Industry Domain Schema**:
  - **Document Classification**: Bill of Lading (B/L), Commercial Invoice, Freight Invoice, Packing List, Customs Declaration, Delivery Order.
  - **Parties**: Shipper / Exporter, Consignee / Importer, Notify Party, Carrier, Freight Forwarder.
  - **Logistics & Route**: Vessel name, Voyage number, Port of Loading (POL), Port of Discharge (POD), Place of Receipt, Place of Delivery, Departure / Arrival dates.
  - **Commercial Terms & Financials**: Incoterms (FOB, CIF, CFR, EXW, DDP, etc.), Payment Terms, Currency, Subtotals, Taxes/Duties, Freight Charges, Total Invoiced Amount.
  - **Cargo & Equipment Details**: Container numbers, seal numbers, container types (20GP, 40HC, Reefer), weights (gross/net/tare), volume (CBM), and itemized cargo line items (HS codes, quantities, unit prices).
- **SQLite Database Tables**:
  - `shipping_documents`: Primary header, routing, parties, and financial data.
  - `line_items`: Itemized commercial cargo, HS codes, unit pricing.
  - `container_details`: Equipment IDs, seal numbers, container types, and tare/gross weights.
- **Real-Time Terminal & Execution Logging**:
  - Formatted server terminal logs with ANSI color codes, timestamps, and stage tags (`[PIPELINE]`, `[GEMINI_CALL]`, `[PARSING]`, `[SQL_INSERT]`, `[SQL_ITEMS]`, `[SQL_COMMIT]`).
  - Interactive live activity log console embedded in the web dashboard for real-time monitoring of document reading and database writes.
- **Modern Next.js Dashboard**:
  - Drag-and-drop PDF upload with progress and confidence score indicators.
  - Full relational data table with type filters and search across reference numbers, parties, and vessels.
  - Interactive modal editor allowing instant updates and additions to database records.
  - Real-time analytics cards displaying total records, total invoice values, and classification breakdown.
  - Strictly follows a clean design system without emojis or favicons.

---

## Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local` or `.env` and insert your Gemini API Key:
```bash
cp .env.example .env.local
```

Inside `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

*(You can also provide a Gemini API Key directly in the web UI at runtime)*

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
npm start
```

---

## Google Cloud Deployment (Cloud Run)

To deploy the container to Google Cloud Run, see the complete guide in [DEPLOYMENT.md](DEPLOYMENT.md) or run:

### Windows (PowerShell):
```powershell
.\deploy-gcp.ps1 -ProjectId "YOUR_GCP_PROJECT_ID" -Region "us-central1" -GeminiApiKey "YOUR_GEMINI_API_KEY"
```

### Linux / macOS (Bash):
```bash
chmod +x deploy-gcp.sh
GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID" ./deploy-gcp.sh
```

---

## Database Verification Script
Run the automated SQLite test script to verify database creation and relational tables:
```bash
npx tsx scripts/test-db.ts
```

---

## Architecture & File Structure

```
shipping_doc_extractor/
├── .env.example              # Environment variables template
├── .gitignore                # Comprehensive git ignore rules
├── package.json              # Project dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── next.config.ts            # Next.js server configuration
├── tailwind.config.ts        # Tailwind styling system
├── data/                     # Persistent SQLite database storage
├── scripts/
│   └── test-db.ts            # Automated SQLite CRUD verification script
└── src/
    ├── types/
    │   └── document.ts       # TypeScript interfaces for shipping documents
    ├── lib/
    │   ├── db.ts             # SQLite initialization, schema, and queries
    │   └── gemini.ts         # Google Gemini multimodal extraction engine
    ├── components/
    │   ├── DocumentUpload.tsx        # Drag & drop PDF uploader with Gemini parser
    │   ├── DocumentTable.tsx         # Database records table view with search & filters
    │   ├── DocumentDetailModal.tsx   # Detailed document inspector & table editor
    │   └── StatsCards.tsx            # KPI analytics counters
    └── app/
        ├── layout.tsx        # Base root layout (no favicons/emojis)
        ├── page.tsx          # Main dashboard view
        ├── globals.css       # Clean corporate typography & theme
        └── api/
            ├── documents/route.ts      # GET (list & search) and POST (manual entry)
            ├── documents/[id]/route.ts # GET, PUT, DELETE document by ID
            ├── extract/route.ts        # Gemini AI PDF parsing endpoint
            └── stats/route.ts          # Aggregate metrics endpoint
```
