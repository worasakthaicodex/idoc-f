# Legacy migration runbook (PHP/MySQL → iDoc/Postgres+Neon)

One-off migration of the 7-year legacy CRM into iDoc. **~100MB real data, ~10 tables,
~400k rows. Single company_id.** Rehearse on local Postgres (:5433) first, then run the
same SQL against Neon at cutover (Saturday).

## Key model facts
- Legacy links logs/docs to a customer by the OLD auto id (`id_refer`). New system links by
  **customer_code (string)**, not UUID. So: store old customer auto id on each migrated
  customer as `attributes.legacyId`, then map everything via legacyId → customer_code.
- `idoc` = document index (1 row/doc: `doc_name`=type CL/FO/QT, `doc_id`=edata auto id).
- `edata` = generic store, **positional columns** (c1,c2,…) whose meaning is defined by a
  **mapper** (per doc_name). Self-ref `main_id`: rows with main_id = a doc id are that doc's
  children = **QT line items**. Doc→doc chain (CL→FO→QT) is a **separate edge table**.
- SO does NOT exist in legacy → born fresh in the new app, not migrated.
- Migrated call/comm logs go into the `activity` table (kind=CALL_RESULT / COMMUNICATION),
  so they show in the existing /customer tools UI (read by customer_code + kind).

## Steps
1. **Export** (Win7): deploy `export.php` at the web root. Set the token, DB name, and the
   real table whitelist. From a machine that reaches both:
   - `curl "http://tracejob.trueddns.com:52890/export.php?key=TOKEN&list=1"`  → verify counts
   - `curl -o idoc.csv "...?key=TOKEN&table=idoc"` (repeat per table; big table → &limit=50000&offset=N&order=<id col>)
   - Verify Thai readable in the CSV; verify row count == COUNT(*) (`&count=1`).
   - **Delete export.php from Win7 after migration.**
2. **Stage** (local): load CSVs into Postgres schema `staging`, all columns `text`
   (`\copy staging.<t> FROM 'x.csv' WITH (FORMAT csv, HEADER true, NULL '\N', QUOTE '"')`).
3. **Transform** (SQL/script, idempotent on company_id+legacyId):
   - customers → `customer` (legacyId in attributes, build legacyId→code map)
   - call/comm logs → `activity` (customer_code via legacyId)
   - docs: idoc drives one `sales_document` per row; edata header → `data` (via mapper);
     QT line items (edata children via main_id) → pivot into `data.items`; chain (edge
     table) → `src_cl/src_fo/src_qt`.
   - files (~200MB) → fetch each via old PHP URL → upload to Firebase → `attachment` rows.
4. **Validate** (local): counts old vs new; orphan count (id_refer with no customer);
   spot-check 10–20 customers end-to-end in the UI.
5. **Cutover** (Neon): same `\copy` + transform, pointed at Neon. **Use the real Neon
   company_id (different UUID than local!).** Disable last_comm_at/last_call_at triggers
   during bulk load, recompute after. `drop schema staging` when done.

## STATUS
- **Phase 1 (customers) VALIDATED on local** (2026-06-13): export_csv.php → register.csv (12,446) →
  staging.stg_register → transform-customer.sql → 12,446 customers in local company QCOMPACT.
  legacyId anchor on all, status passes through (already enum), Thai charset perfect, idempotent.
- **Cutover company_id (Neon / production คิวคอมแพค "Q1") = `9d25f983-32ba-401c-b8a4-e7880c2f204f`**
  (LOCAL QCOMPACT is `1c368950-8537-4507-a1ea-163239e20420` — different UUID, do not mix).
  Cutover = run transform-customer.sql against Neon with `-v cid="'9d25f983-...'"`.
- Note: customer.code = register_code+daterun+register_id (docs link by this); attributes.legacyId
  = register.id PK (logs link by id_refer = this). They differ per row — both stored, both needed.

## STATUS — Phase 2 (documents FO/QT) VALIDATED on local (2026-06-13)
- idoc(document_id 110/113) + edata → `transform-docs.sql` → **9,626 sales_document** (FO 5,834 +
  QT 3,792). customer_ref linked ~86% (via customer_oldsys=register.id → legacyId → code).
  Line items pivoted into data.items (Thai intact), status/closeResult/total mapped, phase from
  current_step. Needed indexes on staging.stg_edata(data_id, "tempId") + robust dz() date parser.
- CORRECTED model: idoc.document_id=type(110 FO/113 QT), idoc.eform_id=edata.data_id (content link),
  idoc.customer_oldsys=register.id, doc code synthesized "FO-{data_id}"/"QT-{data_id}" (data_value1
  mostly null). Header content: extension_id=0 + tempId null; line items: extension_id=0 + tempId=QT
  data_id (v10=name v12=price v14=discount v15=qty v16=unit v17=total). Tools: extension_id 5/6/8.
- TODO: src_fo chain (relations table direction/keys unclear — main_doc_name shows QT, relations_id
  is small ints not data_id; 0 linked). Investigate relations before relying on chain.

## STATUS — Phase 3 (tools/logs) VALIDATED on local (2026-06-13)
- edata(extension_id 5/6/8) → `transform-tools.sql` → **151,865 activity** (COMMUNICATION 82,082 +
  CALL_RESULT 65,207 + CUSTOMER_SYSTEM 4,588). Customer-linked 99.5% via **id_refer = register.id**
  → customer code. created_by=data_nameadd, subject via reference→sales_document. Payloads correct,
  Thai intact, comm dates real. Ran in ~20s with indexes ix_customer_legacyid / ix_salesdoc_legacyid.
  Idempotent on (company_id, payload->>'legacyId').
- KNOWN LEGACY-DATA GAPS / refinements (not blockers): (a) ~60k CALL_RESULT have NO original date in
  source → fall back to data_dateupdate (2026-03-06 cleanup date); only ~5-9k have real dates
  (data_value5/data_dateadd). Unrecoverable. (b) call `result` values are legacy free text — not yet
  value-mapped to the new 7 select options. (c) src_fo chain (relations) still unlinked.
- **ALL 3 DB PHASES DONE on local: customers 12,446 + docs 9,626 + tools 151,865.** Remaining before
  cutover: files→Firebase; optional refinements above. Cutover = run the 3 transform SQLs against Neon
  with cid='9d25f983-32ba-401c-b8a4-e7880c2f204f' (after loading staging there).

## Still needed to write the transform
- The **mapper**: per doc_name, which positional column = name/qty/price/discount/unit
  (line items) + customer id_refer + header fields. (DB table → export it; PHP array → paste.)
- The **edge table** name + its two doc_id columns.
- Confirm `idoc` has 0 rows with doc_name='SO'.
- `SELECT DISTINCT` of customer status / call result / badInfo (for value-maps).
- Decision: customer code = reuse legacy id vs new REG + legacyId; orphan logs = skip vs keep null.
