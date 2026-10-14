# Next-Gen Self-Hosted Garment & Wash ERP System

A world-class, industrial-grade Garment Wash & Production ERP built to surpass commercial ERP platforms by combining real-time wet plant machine telemetry, decentralized Sia cloud backups (`devs.sia.storage`), serverless Puter.com KV state synchronization, and strict role-gated financial intelligence.

## User Review & Critical Decisions

> [!IMPORTANT]
> To surpass existing market ERP solutions, this plan integrates decentralized self-hosted cloud storage (Sia Storage API + Puter serverless KV) alongside local database persistence, while maintaining strict access rules for financial data.

- **Confirmed Decision 1**: **Self-Hosted Storage & Decentralized Cloud Sync** — Hybrid architecture supporting local SQLite/PostgreSQL database, Puter.com serverless key-value replication, and automated Sia Decentralized Storage bucket sync (`devs.sia.storage` integration) for tamper-proof audit trails, PDF invoice backups, and buyer data vault archiving.
- **Confirmed Decision 2**: **Role-Gated Financial Protection** — Financial PnL analytics, wash type-wise revenue calculations, and Accounts modules remain restricted strictly to **Wash MD**, **Wash Manager**, and **System Admin** users.
- **Confirmed Decision 3**: **Industrial High-Density UX** — High-contrast, tabular-numeral industrial dashboard designed for high-throughput wet plant operations, chemical dosing precision, and multi-buyer order management.

---

## 1. Overview & Core Concept

### What It Does
An all-in-one industrial ERP for textile washing, dyeing, and garment finishing factories that manages the complete lifecycle of orders from receiving to final delivery ("First Recv & Last Delivery" log preservation). It features real-time chemical recipe calculators, wet plant batch tracking, automated Sia decentralized cloud storage backup connectors, Puter serverless state replication, and role-segmented executive dashboards.

### Target Audience & Personas
1. **Wash MD / Managing Director**: Full financial overview, wash type-wise monthly revenue (Ravinow bar), net PnL margins, and executive approval tools.
2. **Wash Manager**: Operational oversight, chemical inventory budgeting, batch yield optimization, and order status tracking.
3. **Data Entry Operator**: Daily log submission, batch output recording, and machine occupancy tracking without visibility into cost or profit metrics.
4. **Buyer Representative**: Archival access to Buyer Data Bank for historical specs, shade cards, and delivery records ("Next Plan" clear logic).

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Executive Financial Intelligence Flow**:
   - Wash MD / Manager logs in → Views high-density Dashboard featuring the Monthly Wash Type-wise Revenue & PnL Bar (`WashRevenuePnLBar`).
   - Toggles currency ($ USD / ৳ BDT @ 122.5), inspects process cost distributions (Enzyme, Bleach, Acid, Stone, Vintage, Dyeing), and exports signed PnL audit reports.

2. **Self-Hosted Storage & Sia Backup Flow**:
   - System Admin opens Admin workspace → Selects the **Online Anywhere & Cloud Backup** panel.
   - Configures Sia Storage endpoint (`https://devs.sia.storage`), tests Puter Serverless KV latency, triggers immediate encrypted DB snapshot, and generates QR code access links for mobile management.

3. **Restricted Operator Entry Flow**:
   - Operator logs in with restricted role → Accesses Daily Logs & Order Progress.
   - Financial tabs, cost figures, and Accounts workspace are completely hidden or displayed with a clear security lock notice (`Financial Restricted Access`).

### Visual Identity & Theme
- **Aesthetic Direction**: Technical, data-dense industrial console with high-contrast typography, zero-pill discipline, and clear visual hierarchy.
- **Color Palette**:
  - *Dominant Field (60%)*: Deep slate dark canvas (`#0F172A`) and clean neutral surfaces (`#1E293B` / `#FFFFFF`).
  - *Structural Boundaries (30%)*: Hairline border dividers (`#334155` / `#E2E8F0`) with tabular numeric layout grids.
  - *Accent Allocation (10%)*: Industrial Emerald (`#10B981`) for profit/health, Royal Blue (`#1E6BFF`) for primary actions, Amber (`#F59E0B`) for pending batches, and Crimson (`#EF4444`) for alerts.
- **Typography**:
  - *Display*: `Plus Jakarta Sans` / `Outfit` font for crisp headers and workspace titles.
  - *Prose*: `Public Sans` for scannable administrative metadata.
  - *Data & Telemetry*: `JetBrains Mono` with `tabular-nums` for precise currency amounts, batch weights, and chemical ratios.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Hybrid Decentralized Storage Engine (Sia Storage + Puter KV + Local DB)
- **Chosen Approach**: Combine local file/SQLite storage with Puter.com serverless KV replication and automated Sia storage API (`devs.sia.storage`) export endpoints in `Admin.tsx` and `/api/admin/backup`.
- **Why**: Ensures 100% data durability and remote accessibility even if local factory servers suffer hardware failure or internet drops, directly surpassing conventional single-server ERPs.
- **Alternatives Considered**: Pure cloud database (fails offline) or pure local DB (vulnerable to hardware loss).

### Decision 2: Strictly Enforced Access Permission Matrix
- **Chosen Approach**: Enforce `canViewFinancialMetrics` at both UI context level (`AuthContext.tsx`) and API handler level (`server.ts`).
- **Why**: Prevents unauthorized employees from viewing sensitive unit prices, chemical costs, or profit margins.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INCTRL Wash ERP Client                             │
│  ┌────────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │   AuthContext (Roles)  │  │ WashRevenuePnLBar   │  │  Admin Workspace │  │
│  │  (MD, Manager, Op, Admin) │  │ (Financial Analytics)│  │ (Cloud & Storage)│  │
│  └───────────┬────────────┘  └──────────┬──────────┘  └────────┬─────────┘  │
└──────────────┼──────────────────────────┼──────────────────────┼────────────┘
               │                          │                      │
               ▼                          ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Express Application Server                         │
│  ┌────────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │ Auth & Role Middleware │  │ Financial Data API  │  │ Backup & Storage │  │
│  │  (/api/me, authorize)  │  │ (/api/invoices, PnL)│  │    Controller    │  │
│  └───────────┬────────────┘  └──────────┬──────────┘  └────────┬─────────┘  │
└──────────────┼──────────────────────────┼──────────────────────┼────────────┘
               │                          │                      │
               ▼                          ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Persistence & Storage Layer                         │
│   ┌────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐   │
│   │ Local SQLite / JSON│  │  Puter Serverless   │  │ Sia Storage Cloud  │   │
│   │   Factory DB       │  │   Key-Value Sync    │  │ (devs.sia.storage) │   │
│   └────────────────────┘  └─────────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Alignment
- **Users & Roles**: `admin`, `wash_md`, `wash_manager`, `editor`, `operator`, `viewer`.
- **Log Preservation**: All daily wash logs preserve receiving dates ("First Recv") and shipping dates ("Last Delivery").
- **Buyer Data Bank**: Archived buyer specifications and historical wash cards are safely stored with zero data loss.
