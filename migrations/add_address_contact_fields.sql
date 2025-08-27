-- Migration: Add contact information and address name fields to addresses table
-- Date: 2025-08-11
-- Description: Adds address_name, contact_name, contact_phone, and contact_email fields to the addresses table

-- Add new columns to the addresses table
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS address_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- Update existing rows with default values (optional)
-- You can customize these default values based on your needs
UPDATE addresses 
SET 
  address_name = COALESCE(address_name, 'Address ' || id),
  contact_name = COALESCE(contact_name, 'Default Contact'),
  contact_phone = COALESCE(contact_phone, '(000) 000-0000'),
  contact_email = COALESCE(contact_email, 'noreply@example.com')
WHERE 
  address_name IS NULL 
  OR contact_name IS NULL 
  OR contact_phone IS NULL 
  OR contact_email IS NULL;

-- Make the new fields required (NOT NULL) after setting default values
ALTER TABLE addresses 
ALTER COLUMN address_name SET NOT NULL,
ALTER COLUMN contact_name SET NOT NULL,
ALTER COLUMN contact_phone SET NOT NULL,
ALTER COLUMN contact_email SET NOT NULL;

-- Add indexes for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_addresses_address_name ON addresses(address_name);
CREATE INDEX IF NOT EXISTS idx_addresses_contact_email ON addresses(contact_email);

-- Add a comment to document the changes
COMMENT ON COLUMN addresses.address_name IS 'User-friendly name for the address (e.g., Main Warehouse, Home Office)';
COMMENT ON COLUMN addresses.contact_name IS 'Name of the contact person at this address';
COMMENT ON COLUMN addresses.contact_phone IS 'Phone number of the contact person';
COMMENT ON COLUMN addresses.contact_email IS 'Email address of the contact person';