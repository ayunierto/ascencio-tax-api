-- Migration Script: Update Invoices for Multi-Tenancy
-- Date: 2026-01-14
-- Description: Add issuedAt column and update existing invoices with company assignment

-- 1. Add issuedAt column (TypeORM will do this automatically with synchronize)
-- ALTER TABLE invoices ADD COLUMN issued_at timestamp with time zone;

-- 2. For existing invoices with NULL fromCompanyId, we need to assign a company
-- This script assumes you have at least one company in the system
-- YOU MUST CUSTOMIZE THIS BASED ON YOUR DATA

-- First, let's see what we have:
-- SELECT count(*) FROM invoices WHERE from_company_id IS NULL;
-- SELECT id, name FROM companies LIMIT 5;

-- Option A: Assign all null company invoices to the first available company
-- (UNCOMMENT AND CUSTOMIZE THE COMPANY ID BELOW)

-- UPDATE invoices 
-- SET from_company_id = 'YOUR_DEFAULT_COMPANY_ID_HERE'
-- WHERE from_company_id IS NULL;

-- Option B: Create a default company for orphaned invoices
-- (UNCOMMENT IF YOU NEED TO CREATE A DEFAULT COMPANY)

-- INSERT INTO companies (id, name, legal_name, business_number, address, city, province, postal_code, phone, email, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'Default Company',
--   'Default Company Inc.',
--   '000000000',
--   '123 Default St',
--   'Toronto',
--   'ON',
--   'M5V 3A1',
--   '416-555-0123',
--   'default@company.com',
--   NOW(),
--   NOW()
-- );

-- Then assign invoices to this company:
-- UPDATE invoices 
-- SET from_company_id = (SELECT id FROM companies WHERE name = 'Default Company')
-- WHERE from_company_id IS NULL;

-- 3. Add constraint to make from_company_id NOT NULL (TypeORM will do this)
-- ALTER TABLE invoices ALTER COLUMN from_company_id SET NOT NULL;

-- 4. Update existing 'pending' status invoices to 'draft'
UPDATE invoices 
SET status = 'draft' 
WHERE status = 'pending';

-- 5. For invoices that are already 'paid', set them as 'issued' and add issuedAt
UPDATE invoices 
SET 
  status = 'issued',
  issued_at = created_at
WHERE status = 'paid' AND issued_at IS NULL;

-- Verification queries (run these after the migration):
-- SELECT status, count(*) FROM invoices GROUP BY status;
-- SELECT count(*) FROM invoices WHERE from_company_id IS NULL;
-- SELECT count(*) FROM invoices WHERE status = 'issued' AND issued_at IS NOT NULL;