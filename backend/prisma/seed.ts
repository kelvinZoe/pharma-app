import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const getPrismaClient = () => {
  const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:');
  if (isProduction) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } else {
    const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
    return new PrismaClient({ adapter });
  }
};

const prisma = getPrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Departments
  console.log('Seeding departments...');
  const labDept = await prisma.department.upsert({
    where: { name: 'Laboratory' },
    update: {},
    create: {
      name: 'Laboratory',
      code: 'LAB',
      isActive: true,
    },
  });

  const scanDept = await prisma.department.upsert({
    where: { name: 'Scanning' },
    update: {},
    create: {
      name: 'Scanning',
      code: 'SCAN',
      isActive: true,
    },
  });

  console.log(`Seeded Departments: ${labDept.name}, ${scanDept.name}`);

  // 2. Seed Users for each of the 6 roles
  console.log('Seeding default accounts (password: password123)...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const usersData = [
    {
      username: 'admin',
      fullName: 'Admin User',
      passwordHash,
      role: 0,
      module: 'admin',
      phone: '0241112222',
      email: 'admin@clinic.com',
    },
    {
      username: 'frontdesk',
      fullName: 'Frontdesk User',
      passwordHash,
      role: 1,
      module: 'frontdesk',
      phone: '0242223333',
      email: 'frontdesk@clinic.com',
    },
    {
      username: 'laboratory',
      fullName: 'Laboratory User',
      passwordHash,
      role: 2,
      module: 'laboratory',
      phone: '0243334444',
      email: 'lab@clinic.com',
    },
    {
      username: 'scanning',
      fullName: 'Scanning User',
      passwordHash,
      role: 3,
      module: 'scanning',
      phone: '0244445555',
      email: 'scan@clinic.com',
    },
    {
      username: 'pharmacy',
      fullName: 'Pharmacy User',
      passwordHash,
      role: 4,
      module: 'pharmacy',
      phone: '0245556666',
      email: 'pharmacy@clinic.com',
    },
    {
      username: 'accounting',
      fullName: 'Accounting User',
      passwordHash,
      role: 5,
      module: 'accounting',
      phone: '0246667777',
      email: 'accounting@clinic.com',
    },
  ];

  for (const userData of usersData) {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {
        passwordHash, // reset password to password123
        role: userData.role,
        module: userData.module,
      },
      create: userData,
    });
    console.log(`- User: ${user.username} (${user.fullName}) - Role ${user.role} - Module ${user.module}`);
  }

  // 3. Seed Base Services
  console.log('Seeding clinic services catalog...');
  const services = [
    // Lab Services
    { name: 'Full Blood Count', price: 80.00, departmentId: labDept.id },
    { name: 'Malaria Rapid Diagnostic Test', price: 40.00, departmentId: labDept.id },
    { name: 'Lipid Profile', price: 120.00, departmentId: labDept.id },
    { name: 'Urinalysis', price: 35.00, departmentId: labDept.id },
    { name: 'Blood Glucose Test', price: 30.00, departmentId: labDept.id },
    { name: 'Typhoid Test (Widal)', price: 45.00, departmentId: labDept.id },
    
    // Scan Services
    { name: 'Abdominal Ultrasound', price: 150.00, departmentId: scanDept.id },
    { name: 'Chest X-Ray (A/P)', price: 180.00, departmentId: scanDept.id },
    { name: 'Pelvic Ultrasound', price: 120.00, departmentId: scanDept.id },
    { name: 'MRI Brain Scan (Plain)', price: 950.00, departmentId: scanDept.id },
    { name: 'Electrocardiogram (ECG)', price: 100.00, departmentId: scanDept.id },
    { name: 'CT Scan Head (Plain)', price: 650.00, departmentId: scanDept.id },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({
      where: { name: s.name },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          name: s.name,
          price: s.price,
          departmentId: s.departmentId,
        },
      });
      console.log(`- Service created: ${s.name} (GHS ${s.price.toFixed(2)})`);
    } else {
      await prisma.service.update({
        where: { id: existing.id },
        data: { price: s.price, departmentId: s.departmentId },
      });
      console.log(`- Service updated: ${s.name} (GHS ${s.price.toFixed(2)})`);
    }
  }

  // 4. Seed Pharmacy Products
  console.log('Seeding pharmacy inventory catalog...');
  const products = [
    { name: 'Paracetamol 500mg', productCode: 'PXM001', unitOfMeasure: 'tablet', reorderLevel: 100 },
    { name: 'Amoxicillin 250mg', productCode: 'AMX002', unitOfMeasure: 'capsule', reorderLevel: 50 },
    { name: 'Ibuprofen 400mg', productCode: 'IBU003', unitOfMeasure: 'tablet', reorderLevel: 50 },
    { name: 'Cough Syrup 100ml', productCode: 'CSY004', unitOfMeasure: 'bottle', reorderLevel: 20 },
    { name: 'Artemether-Lumefantrine (Coartem)', productCode: 'COA005', unitOfMeasure: 'pack', reorderLevel: 30 },
    { name: 'Vitamin C 100mg', productCode: 'VIT006', unitOfMeasure: 'tablet', reorderLevel: 200 },
    { name: 'Ciprofloxacin 500mg', productCode: 'CIP007', unitOfMeasure: 'tablet', reorderLevel: 40 },
    { name: 'Salbutamol Inhaler', productCode: 'SAL008', unitOfMeasure: 'inhaler', reorderLevel: 10 },
  ];

  for (const p of products) {
    await prisma.pharmacyProduct.upsert({
      where: { productCode: p.productCode },
      update: {
        name: p.name,
        unitOfMeasure: p.unitOfMeasure,
        reorderLevel: p.reorderLevel,
      },
      create: p,
    });
    console.log(`- Pharmacy Product: ${p.name} [${p.productCode}]`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
