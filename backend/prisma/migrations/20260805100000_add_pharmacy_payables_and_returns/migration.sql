ALTER TABLE "PharmacyGoodsReceiptLine"
ADD COLUMN IF NOT EXISTS "quantityReturned" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PharmacySupplierInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "creditAmount" DECIMAL NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    CONSTRAINT "PharmacySupplierInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacySupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierInvoice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierInvoice_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PharmacyGoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacySupplierPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expenseId" TEXT,
    CONSTRAINT "PharmacySupplierPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacySupplierPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierPayment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PharmacySupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacySupplierPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacyPurchaseReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "totalCredit" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    CONSTRAINT "PharmacyPurchaseReturn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyPurchaseReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturn_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PharmacyGoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PharmacySupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacyPurchaseReturnLine" (
    "id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL NOT NULL,
    "lineTotal" DECIMAL NOT NULL,
    "returnReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "receiptLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    CONSTRAINT "PharmacyPurchaseReturnLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyPurchaseReturnLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PharmacyPurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturnLine_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "PharmacyGoodsReceiptLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseReturnLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierInvoice_receiptId_key" ON "PharmacySupplierInvoice"("receiptId");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierInvoice_tenantId_invoiceNumber_key" ON "PharmacySupplierInvoice"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "PharmacySupplierInvoice_tenantId_supplierId_supplierInvoiceNumber_idx" ON "PharmacySupplierInvoice"("tenantId", "supplierId", "supplierInvoiceNumber");
CREATE INDEX IF NOT EXISTS "PharmacySupplierInvoice_tenantId_locationId_status_dueDate_idx" ON "PharmacySupplierInvoice"("tenantId", "locationId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "PharmacySupplierInvoice_tenantId_supplierId_invoiceDate_idx" ON "PharmacySupplierInvoice"("tenantId", "supplierId", "invoiceDate");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierPayment_expenseId_key" ON "PharmacySupplierPayment"("expenseId");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierPayment_tenantId_paymentNumber_key" ON "PharmacySupplierPayment"("tenantId", "paymentNumber");
CREATE INDEX IF NOT EXISTS "PharmacySupplierPayment_tenantId_locationId_paymentDate_idx" ON "PharmacySupplierPayment"("tenantId", "locationId", "paymentDate");
CREATE INDEX IF NOT EXISTS "PharmacySupplierPayment_tenantId_supplierId_paymentDate_idx" ON "PharmacySupplierPayment"("tenantId", "supplierId", "paymentDate");
CREATE INDEX IF NOT EXISTS "PharmacySupplierPayment_tenantId_invoiceId_idx" ON "PharmacySupplierPayment"("tenantId", "invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyPurchaseReturn_tenantId_returnNumber_key" ON "PharmacyPurchaseReturn"("tenantId", "returnNumber");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturn_tenantId_locationId_returnDate_idx" ON "PharmacyPurchaseReturn"("tenantId", "locationId", "returnDate");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturn_tenantId_supplierId_returnDate_idx" ON "PharmacyPurchaseReturn"("tenantId", "supplierId", "returnDate");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturn_tenantId_receiptId_idx" ON "PharmacyPurchaseReturn"("tenantId", "receiptId");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturnLine_tenantId_returnId_idx" ON "PharmacyPurchaseReturnLine"("tenantId", "returnId");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturnLine_tenantId_receiptLineId_idx" ON "PharmacyPurchaseReturnLine"("tenantId", "receiptLineId");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseReturnLine_tenantId_productId_idx" ON "PharmacyPurchaseReturnLine"("tenantId", "productId");

INSERT INTO "PharmacySupplierInvoice" (
    "id", "invoiceNumber", "supplierInvoiceNumber", "invoiceDate", "dueDate", "totalAmount", "balanceDue",
    "status", "createdAt", "updatedAt", "tenantId", "locationId", "supplierId", "receiptId", "createdByUserId"
)
SELECT
    gen_random_uuid()::text,
    'PINV-' || receipt."receiptNumber",
    COALESCE(NULLIF(TRIM(receipt."supplierInvoiceNumber"), ''), 'LEGACY-' || receipt."receiptNumber"),
    receipt."receivedAt",
    receipt."receivedAt" + (supplier."paymentTermsDays" * INTERVAL '1 day'),
    receipt."totalCost",
    receipt."totalCost",
    'unpaid',
    receipt."createdAt",
    CURRENT_TIMESTAMP,
    receipt."tenantId",
    receipt."locationId",
    receipt."supplierId",
    receipt."id",
    receipt."createdByUserId"
FROM "PharmacyGoodsReceipt" receipt
JOIN "PharmacySupplier" supplier ON supplier."id" = receipt."supplierId"
WHERE receipt."supplierId" IS NOT NULL
ON CONFLICT ("receiptId") DO NOTHING;
