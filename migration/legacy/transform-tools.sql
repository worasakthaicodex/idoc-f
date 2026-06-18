-- transform-tools.sql — edata(extension_id 5/6/8) -> activity (comm/call/system)
-- idempotent on (company_id, payload->>'legacyId'). usage: psql ... -v cid="'<uuid>'" -f transform-tools.sql
\set ON_ERROR_STOP on
create or replace function staging.nz(t text) returns text language sql immutable as
$$ select nullif(nullif(btrim($1), ''), '\N') $$;
create or replace function staging.dz(t text) returns timestamptz language plpgsql immutable as
$$ begin
     if btrim(t) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' then return null; end if;
     return btrim(t)::timestamptz;
   exception when others then return null;
   end $$;

create index if not exists ix_customer_legacyid on customer (company_id, (attributes->>'legacyId'));
create index if not exists ix_salesdoc_legacyid on sales_document (company_id, (data->>'legacyId'));
create unique index if not exists ux_activity_legacy on activity (company_id, (payload->>'legacyId'))
  where payload->>'legacyId' is not null;

insert into activity (id, company_id, kind, subject_type, subject_code, customer_code,
                      occurred_at, created_by, payload, status, created_at, updated_at)
select
  gen_random_uuid(),
  :cid::uuid,
  case e.extension_id when '5' then 'COMMUNICATION' when '6' then 'CALL_RESULT' else 'CUSTOMER_SYSTEM' end,
  sd.doc_type,                                                       -- subject_type (if attached to a doc)
  sd.code,                                                           -- subject_code
  c.code,                                                            -- customer_code (via id_refer = register.id)
  coalesce(staging.dz(e.data_value2), staging.dz(e.data_value5),     -- occurred_at (best available)
           staging.dz(e.data_dateadd), staging.dz(e.data_dateupdate), now()),
  staging.nz(e.data_nameadd),                                        -- created_by
  jsonb_strip_nulls(case e.extension_id
    when '5' then jsonb_build_object('message', staging.nz(e.data_value1))
    when '6' then jsonb_build_object('result', staging.nz(e.data_value1), 'minutes', staging.nz(e.data_value2),
                                     'problem', staging.nz(e.data_value3), 'badInfo', staging.nz(e.data_value4))
    else          jsonb_build_object('system', staging.nz(e.data_value1), 'expiry', staging.nz(e.data_value2),
                                     'scope', staging.nz(e.data_value3), 'note', staging.nz(e.data_value4))
  end) || jsonb_build_object('legacyId', e.data_id),
  'ACTIVE', now(), now()
from staging.stg_edata e
left join customer c on c.company_id = :cid::uuid and c.attributes->>'legacyId' = e.id_refer
left join sales_document sd on sd.company_id = :cid::uuid and (sd.data->>'legacyId') = nullif(e.reference, '0')
where e.extension_id in ('5','6','8')
on conflict (company_id, (payload->>'legacyId')) where payload->>'legacyId' is not null
do update set customer_code = excluded.customer_code, subject_type = excluded.subject_type,
  subject_code = excluded.subject_code, occurred_at = excluded.occurred_at,
  created_by = excluded.created_by, payload = excluded.payload, updated_at = now();
