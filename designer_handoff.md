# UI/UX Designer Handoff Specification: Radiography Clinic & Pharmacy Management System

This specification document outlines the UX layout, visual aesthetics, user workflows, and core UI components for our high-fidelity **Radiography Clinic & Pharmacy Management System**. It is designed to help you construct premium, modern high-fidelity vector mockups (Figma, Sketch, or Adobe XD) representing the complete system.

---

## 🎨 1. Global Visual & Aesthetic Guidelines

### Theme & Palette (Standard Clean Medical Teal & Light Neutral)
* **Primary / Accent Color**: Medical Teal (`#0d9488`). Used for active primary buttons, status badges, active navigation indicators, and primary CTAs.
* **Secondary / Active Color**: Soft Mint / Teal (`#10b981` / `#f0fdfa`). Used for success states, filled progress trackers, and soft panel backgrounds.
* **Background Scale**: Crisp Light Slate Neutral (`#f8fafc` for body background; `#ffffff` for cards, dialogs, and workspace grids).
* **Alert / Attention Scale**: 
  - Expiry Warning / Low Stock: Warm Amber (`#f59e0b` / background `#fef3c7`)
  - Danger / Error: Vibrant Coral Red (`#ef4444` / background `#fee2e2`)
* **Currency Marker**: High contrast styling for **Ghana Cedis (₵ / GHS)**.

### Styling & Geometry (Simple Yet Pleasing Flat Design)
* **Radius System**: Standard rounded interface corners (`border-radius: 8px` to `12px` for panels and cards; `6px` to `8px` for buttons, inputs, and controls).
* **Aesthetic Details**:
  - **Flat UI Approach**: Clean solid backgrounds (`background: #ffffff`) with elegant solid borders (`1px solid #e2e8f0`) instead of glassmorphism.
  - **Soft Shadows**: Standard pleasing elevation shadows (`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)`).
  - **Typography**: Modern humanist/geometric sans-serif typography (e.g., *Inter*, *Segoe UI*, or *Roboto*). Clear visual hierarchy with strong typographic sizes.
  - **Custom Scrollbars**: Thin, clean scrollbar tracks integrated seamlessly into data panels.nels.

---

## 🔑 2. Portal & View-by-View Specifications

The application uses dynamic **role-based navigation**. There are 6 primary user roles plus a unified, beautiful Login Interface.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              LOGIN PAGE                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Redirect by Role)
 ┌───────────────┬──────────────────┼──────────────────┬────────────────┐
 │               │                  │                  │                │
 ▼               ▼                  ▼                  ▼                ▼
Frontdesk     Laboratory         Scanning           Pharmacy        Accounting
(Reception/   (Lab Reports,      (Radiology,        (POS, Inventory, (Dashboards,
 Checkout)    Prescriptions)     X-Ray Reports)     Batches, Alerts)  CSV Export)
```

---

### Page 0: Simple & Pleasing Unified Login
* **Layout**: A clean, centered, elegant login card on a soft neutral slate backdrop (`#f1f5f9`). Left side contains a solid teal branding panel, right side contains the clean input forms.
* **Core Components**:
  - Double inputs: **Username** & **Password** using custom float-label animations.
  - Interactive "Sign In" button with teal fill, white text, and a standard loading spinner state.
  - Clean error banner area that supports animated fade-ins if connectivity fails.

---

### Page 1: Frontdesk Portal (Demographics, Visit Setup, and Clinic Billing)
Designed for high throughput. Split into three primary functional sub-tabs:

#### 1.1 Patient Registration & Search View
* **Left Column (Search Pane)**:
  - Real-time search input bar with active filtering as you type.
  - Result cards displaying patient ID, full name, age/gender, and last visit date.
* **Right Column (Demographics Form)**:
  - Complete form containing fields: Full Name, Date of Birth, Gender (custom interactive radio pill cards), Phone Number, and Residential Address.
  - "Register Patient" CTA button that triggers a confetti micro-interaction upon successful submission.

#### 1.2 Visit Queue & Checklist Setup
* **Main Stage**:
  - Active search header to select a patient.
  - **Department Selector**: Clinical departments (e.g. *Laboratory*, *Scanning*) shown as clickable cards containing department icons.
  - **Service Checklist Panel**: A clean checkbox list of the specific clinic services belonging to that department (e.g. *Full Blood Count*, *Chest X-Ray*), along with their corresponding prices in GHS (`₵`).
  - **Checkout Preview Box**: Real-time sum total calculator of selected services.
  - Action button: "Commit and Send to Queue".

#### 1.3 Clinic Billing & Cashier Desk
* **Left Column (Unpaid Queue)**:
  - List of active patient visits waiting to checkout.
* **Right Column (Invoice Summary & Payment panel)**:
  - Highly professional receipt-style layout.
  - **Invoice Itemized Breakdown**: Displays service name, quantity, and individual prices in GHS.
  - **CRITICAL DESIGN REQUIREMENT**: Service lines that were flagged as `not_done` by doctors/technicians during diagnostics **MUST be omitted/crossed out and have their cost automatically subtracted (set to ₵0.00) from the final checkout balance**.
  - **Payment Mode Pills**: Clickable selection tabs: **[ Cash ]** or **[ Mobile Money ]** (Momo).
  - **Momo Fields Overlay**: Appears only if Momo is selected, requesting *Transaction ID* and *Network provider*.
  - **Checkout CTA**: Green, high-contrast button labeled "Complete Payment & Close Visit (₵ XXX.XX)" (strict rule: zero partial billing, full payments only).

---

### Page 2: Clinical Diagnostic Workspace (Laboratory)
A dense workspace designed for technicians to capture results and write prescriptions.

* **Left Side: Lab Worklist Queue**:
  - Vertical list of active patients checked in for laboratory diagnostics.
  - Badges showing the status of each assigned test (*Pending*, *In Progress*, *Done*, *Not Done*).
* **Right Side: Diagnostics Processing Suite**:
  - **Result Capture Cards**: Displays each ordered service. If a service has a structured result template configured (e.g., *Full Blood Count*: fields for Hb, WBC, Platelets), render these fields dynamically as numerical input boxes with normal reference range labels beside them.
  - **Preset Dropdown / Presets Action**: A button allowing technicians to quickly fill fields using configured standard normal presets, reducing typing.
  - **"Not Done" Action**: A discrete red warning button labeled "Mark as Not Done". Clicking this toggles a modal to input the required justification/reason (e.g. *Reagent Out of Stock*), which automatically crosses out the service cost on checkout.
  - **Prescriber Notepad**: A dedicated, elegant textarea box for free-text medical prescriptions.
  - **Save & Finalize CTAs**: "Save Draft" and "Finalize & Send to Billing" buttons with active visual states.

---

### Page 3: Clinical Diagnostic Workspace (Scanning / Radiology)
Similar layout structure to Laboratory but tailored for radiography.

* **Radiology Worklist**:
  - Active patients checked in for Scanning (e.g., X-Rays, Ultrasounds, Head CTs).
* **Radiology Processing Suite**:
  - Structured template input blocks (e.g. standard fields for radiologist findings: *Clinical Indications*, *Findings Summary*, *Conclusions*).
  - "Mark as Not Done" option with reasoning popups.
  - Free-text prescription writer notebook.

---

### Page 4: Pharmacy Suite (Direct POS Sale & Referred Queue)
Split into three functional sub-tabs:

#### 4.1 Pharmacy Direct POS (Direct Walk-in Sale)
* **Left Pane (Catalog grid & Search)**:
  - Grid of available pharmaceutical products. Each product card displays the drug name, product code, in-stock quantity badge, and unit price (e.g., `Paracetamol 500mg - ₵0.20 / tablet`).
  - Active search bar with quick filters.
* **Right Pane (Current POS Basket)**:
  - List of selected products.
  - **Batch Selection Dropdowns**: When a drug is added to the basket, POS must display a dropdown allowing the pharmacist to select which active inventory batch they are dispensing from, detailing the expiry date of the selected batch.
  - **Payment Selection & Receipt Generator**: Cash/Momo selection pill controls, total calculations, and a high-fidelity "Print Thermal Receipt" checkout action.

#### 4.2 Referred Prescriptions Queue
* **List View**: Active referred prescription orders originating from the Lab or Scanning desks.
* **Fulfillment Window**:
  - Selecting a prescription opens the patient detail and the doctor's free-text prescription card.
  - Pharmacist maps the prescription to the actual inventory products, selects the appropriate batch, sets the quantity, and performs the checkout instantly, updating stock numbers and marking the prescription as fulfilled.

#### 4.3 Batch Inventory Manager
* **Data Grid**:
  - Detailed tabular view of products and active batches.
  - Columns: Product Name, Product Code, Batch Number, Quantity In Stock, Expiry Date, Reorder Level.
  - **Critical Warning Indicators**:
    - *Low Stock Warning*: A highly noticeable Amber icon/badge next to batches where quantity is below the reorder level.
    - *Near-Expiry Alert*: High contrast warning badges showing a countdown if a batch is within 3 months of expiration, turning Red if expired.
  - **"Add Inventory Batch" Action Form**: Modern side-panel form to register a new batch (Batch number, Qty, Cost Price, Selling Price, and Expiry Date picker).

---

### Page 5: Accounting & Financial Analytics Portal
An elegant, modern analytics dashboard for clinic managers and accountants.

* **Top Row (Financial Scorecard)**:
  - 3 large, visually stunning cards with smooth gradient backdrops:
    1. **Combined System Revenue**: Shows grand total in GHS (`₵`) with positive/negative growth percentages.
    2. **Clinic Revenue Contribution**: Subtotal of all service invoice checkout payments.
    3. **Pharmacy Revenue Contribution**: Subtotal of all direct POS & prescription sales.
* **Middle Section (Visual Analytics)**:
  - **Ratio Donut Chart**: Beautiful visual ratio representation of Cash vs Mobile Money (Momo) payments.
  - **Quick Alert Panels**: Scrollable list of active inventory alerts (e.g., 3 products critically low in stock; 2 batches expired).
* **Bottom Section (Transaction Ledger & Export)**:
  - **Date Range Filters**: Interactive date picker inputs with custom start/end date bounds.
  - **Tabular Ledger Log**: Grid list of all payments completed in the system, showing Patient, Payment Timestamp, Amount (₵), Payment Source (Clinic Invoice vs. Pharmacy Sale), Payment Method (Cash vs. Momo), and Status.
  - **Export Ledgers Button**: A primary, glowing button with an Excel/CSV icon labeled "Export Financial Ledger (CSV)".

---

### Page 6: Admin Control Center
A tabular management layout for administrative configuration.

* **6.1 User Management Sub-Tab**:
  - Grid list showing active staff accounts, full names, roles, and connected departments.
  - Interactive "New User Modal" with field validation states.
* **6.2 Services & Pricing Catalog Sub-Tab**:
  - Data table of all offered clinic services, categorized by department (Laboratory vs Scanning).
  - Modern inline pricing editor to configure GHS amounts, and a setup window to build structured diagnostic input templates (adding/removing input fields, setting normal ranges, and configuring presets).

---

## 🖨️ 3. Printable High-Fidelity Layouts

Our system outputs physical paper layouts. Please design mockups representing these printable frames:

### 3.1 Medical Diagnostic Report (A4 Layout)
* **Design Aesthetic**: Clean, structured, clinical, white background with dark typography (optimized for standard monochrome or color office printers).
* **Layout Structure**:
  - **Clinic Header**: Professional letterhead with clinic name, contact details, email, and a modern medical emblem logo placeholder.
  - **Patient Info Block**: Grid layout containing Patient ID, Name, Age/Gender, Date of Visit, and Requesting Physician.
  - **Diagnostic Results Panel**: Tabular format presenting service/test names, captured numeric/text values, and reference normal ranges in separate columns.
  - **Signature Box**: Clean line indicator at the bottom right corner labeled "Authorized Diagnostician Signature / Stamp" with a date marker.

### 3.2 Compact Thermal POS Receipt (58mm / 80mm Layout)
* **Design Aesthetic**: Narrow strip format, high-contrast typography, clear section separators (`------------------`).
* **Layout Structure**:
  - **Receipt Header**: Bold, centered clinic/pharmacy name and phone contact.
  - **Transaction Metadata**: Receipt ID, Timestamp, and Cashier Name.
  - **Itemized Purchase Table**:
    - Columns: Item (Name + Batch Number), Qty x Unit Price, Total.
    - Ex: `Amoxicillin 250mg (Bch: AMX-09) | 10 x ₵0.50 | ₵5.00`
  - **Checkout Totals Summary**: Bold totals highlighting Subtotal, Tax/VAT (if any), and Net Amount paid in GHS (`₵`).
  - **Payment Footer**: Shows method (*PAID VIA MOMO* with Transaction ID, or *PAID VIA CASH*), followed by a warm checkout footer greeting (*"Thank you for choosing us. Get well soon!"*).

---

## ⚙️ 4. Key Interactive Components & Feedback States

When building UI kits or design assets for this platform, include these vital interactive states:

* **Text Inputs (Floating Label Style)**:
  - *Default/Empty*: Light grey placeholder inside input bounds.
  - *Focused*: Accent Indigo border, label slides up to the top margin in small active font.
  - *Error/Invalid*: Red border, small helper error message text slides in below the box.
* **Interactive Radio Pill Selector Cards**:
  - Used for selecting Genders or Payment Options.
  - Deselected cards have standard subtle borders; selected cards have a glowing primary fill background, solid white icon/text, and an active check badge inside the corner.
* **Loading and Progress Overlays**:
  - Subtle blur overlay with a spinning loading wheel inside buttons or grid containers while data is fetching or saving to backend database servers.
* **Dynamic Low-Stock and Expiry Warnings**:
  - Use contrasting warning colors (Amber & Red) with simple alert icons to ensure technicians can instantly triage reorders and dump expired drug batches before patient checkout.
