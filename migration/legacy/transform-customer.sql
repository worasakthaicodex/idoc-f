-- transform-customer.sql — staging.stg_register -> customer (idempotent on company_id+code)
-- usage: psql ... -v cid="'<company-uuid>'" -f transform-customer.sql
--   local rehearsal company QCOMPACT = 1c368950-8537-4507-a1ea-163239e20420
\set ON_ERROR_STOP on

-- null normalizer: '' and literal '\N' (load artifact) -> NULL
create schema if not exists staging;
create or replace function staging.nz(t text) returns text language sql immutable as
$$ select nullif(nullif(btrim($1), ''), '\N') $$;
-- clean 'YYYY-MM-DD...' -> timestamptz, junk/0000 -> null
create or replace function staging.dz(t text) returns timestamptz language sql immutable as
$$ select case when btrim($1) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and btrim($1) not like '0000%'
                then btrim($1)::timestamptz end $$;

insert into customer (id, company_id, code, name, status, group_name, attributes,
                      pending_delete_at, created_at, updated_at)
select
  gen_random_uuid(),
  :cid::uuid,
  s.register_code || s.register_daterun || '-' || s.register_id,          -- code = REG{ym}-{id}
  coalesce(staging.nz(s.register_name), '(ไม่มีชื่อ)'),                     -- name (NOT NULL)
  coalesce(staging.nz(s.register_status), 'ACTIVE'),                       -- status enum (already matches)
  staging.nz(s.register_groups),                                          -- group_name
  jsonb_strip_nulls(jsonb_build_object(
    'legacyId',          s.id,                                            -- ANCHOR (= id_refer in logs/docs)
    'legacyIdOldsys',    staging.nz(s.id_oldsys),
    'legacyMergedIds',   staging.nz(s.merged_duplicate_ids),
    'legacyRevision',    staging.nz(s.revision),
    'registerTitle',     staging.nz(s.register_title),
    'partyType',         staging.nz(s.party_type),
    'grade',             staging.nz(s.register_grade),
    'point',             staging.nz(s.register_poin),
    'businessType',      staging.nz(s.business_type),
    'productCategory',   staging.nz(s.product_category),
    'categorization',    staging.nz(s.categorization),
    'behavior',          staging.nz(s.behavior),
    'contactPerson',     staging.nz(s.contact_person),
    'personPosition',    staging.nz(s.person_position),
    'personNumber',      staging.nz(s.person_number),
    'personEmail',       staging.nz(s.person_email),
    'phone',             staging.nz(s.phone_number),
    'mobile',            staging.nz(s.mobile_number),
    'email',             staging.nz(s.register_email),
    'fax',               staging.nz(s.fax),
    'website',           staging.nz(s.website),
    'social',            staging.nz(s.social),
    'addressFull',       staging.nz(s.register_fulladdress),
    'address',           staging.nz(s.register_address),
    'region',            staging.nz(s.region),
    'lat',               staging.nz(s.lat),
    'lon',               staging.nz(s.lon),
    'taxId',             staging.nz(s.tax_id),
    'dbd',               staging.nz(s.dbd),
    'branchCode',        staging.nz(s.branch_code),
    'paymentTerms',      staging.nz(s.payment_terms),
    'creditLimit',       staging.nz(s.credit_limit),
    'bankAccount',       staging.nz(s.bank_account),
    'preferredCurrency', staging.nz(s.preferred_currency),
    'capital',           staging.nz(s.register_capital),
    'headcount',         staging.nz(s.register_headcount),
    'horsepower',        staging.nz(s.register_horsepower),
    'approverName',      staging.nz(s.contact_approvers),
    'approverPosition',  staging.nz(s.approvers_position),
    'approverPhone',     staging.nz(s.approvers_number),
    'approverEmail',     staging.nz(s.approvers_email),
    'note',              staging.nz(s.register_note),
    'otherConditions',   staging.nz(s.register_other_conditions)
  )),
  case when staging.nz(s.register_status) = 'PENDING_DELETE'
       then coalesce(staging.dz(s.updated_at), now()) end,                -- pending_delete_at
  coalesce(staging.dz(s.date_insert_oldsys), now()),                      -- created_at = real registration date
  now()
from staging.stg_register s
on conflict (company_id, code) do update set
  name = excluded.name, status = excluded.status, group_name = excluded.group_name,
  attributes = excluded.attributes, pending_delete_at = excluded.pending_delete_at,
  updated_at = now();
