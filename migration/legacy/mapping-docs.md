# Mapping — legacy documents (idoc + edata) → new `sales_document`

`idoc` = document index (1 row/doc, the DRIVER — one sales_document per idoc row).
Header + workflow live in `idoc`; body fields + line items live in `edata`.

## CORRECTED JOIN MODEL (verified from real data 2026-06-13)
- **`idoc` is the DRIVER** (not `doc`). Filter `idoc.document_id IN ('110','113')` = FO/QT.
  Counts: FO(110)=5,834 + QT(113)=3,987 = **9,821 documents** to migrate.
- **`idoc.document_id` = doc TYPE** (110=FO, 113=QT). (NOT eform_id!)
- **`idoc.eform_id` = the content link = `edata.data_id`** (e.g. 4933). Pull edata body via this.
- **`idoc.customer_oldsys` = register.id** = customer legacyId anchor → join customer by
  attributes.legacyId (no need for the edata customer-code, this is cleaner).
- `idoc.closing_status` = Thai won/lost ("ปิดการขายได้..."=won, "ปิดการขายไม่ได้"=lost) → closeResult.
- `idoc.current_step`/date/date_end/sender/receiver/creator/sale_oldsys/qttotal_oldsys → workflow.
- Real doc CODE is in **edata.data_value1** (per user), NOT the `doc` table (`doc` has only 568
  rows = a partial official-number registry; ignore as driver).
- chain: `relations` main_id/relations_id = edata.data_id (= the eform_id values), main_id=FO parent.

## idoc → sales_document (header + workflow)
| legacy idoc | → new | note |
|---|---|---|
| `eform_id` | `doc_type` | **CONFIRMED = document type: 113 = QT, 110 = FO** (CL number TBD). eform_id is the TYPE only, NOT the edata link. |
| `???` (TBD, exists) | `data.legacyId` | idoc has a column = edata.data_id (internal id; the value tool `reference` points to). This is the ANCHOR, **not** the human doc code. Need its name. |

**FILTER**: idoc holds OTHER doc types too (10,174 rows total). Export all (tiny), then in
the transform keep only **`eform_id IN (110, 113)`** = FO/QT. edata likewise: only process
content/line-items/tools belonging to FO/QT docs (filtered via the idoc join).

**Doc model = 4 tables** (only **FO + QT** migrate — **CL NOT migrated, SO doesn't exist**):
- `idoc` — workflow/header (eform_id = type 113=QT/110=FO; current_step; creator/sender/receiver; closing_status; expired; date/date_end)
- `edata` — content (positional data_value*) + line items (children via main_id)
- `doc` — REAL document code: `doc_type + doc_date + '-' + doc_autoid` (composite, like the
  customer code). `doc_idrefer` = join to idoc. `doc_rv` = revision. → sales_document.code
  (reuse) / data.legacyCode; data.legacyId = internal edata.data_id (tool.reference anchor).
- `relations` = edge/chain table: `main_id` = parent FO's data_id, `relations_id` = child
  QT's data_id (both are edata.data_id). → fill QT.src_fo: find relations where
  relations_id = QT.data_id → main_id = FO.data_id → map to FO's new code.
  CAUTION: two different main_id — `edata.main_id` (line item→its doc) vs `relations.main_id`
  (FO parent doc). Different tables, both point at edata.data_id.

**NOTE: the idoc↔doc↔edata join keys are described inconsistently in prose (eform_id stated
as both "type 113/110" and "= doc.doc_idrefer"). DO NOT guess — resolve from the real CSV
headers + sample rows (export idoc/edata/doc/edge and read).**
| `current_step` | stage/phase | Create→จัดทำ, Proceed→ดำเนินการ, Completion→เสร็จสิ้น (legacy 3 steps → map to new workflow stages; new has more, map to subset) |
| `date` | created / data.savedAt | created date |
| `creator` | data.createdBy | |
| `sender` | sent.by | |
| `receiver` | received.by / sent.recipients | |
| `closing_status` | data.closeResult | win/lose → met/missed (QT won/lost) |
| `expired` | age flag | 0 active / 1 expired |
| `date_end` | data.closeDate | closing date |
| (link to edata) | `data.legacyId` | the data_id used to pull edata body + by tool `reference` |

## edata body for FO/QT — TODO (waiting on user, same format as tools)
Need: for a document's body, which `extension_id` + which `data_value1..N` = which header
field (doc no, customer ref, dates, amounts, terms, status, …). And line items (QT
sub-table) = child edata rows (main_id = doc's data_id): which extension_id + which
data_value = ชื่อสินค้า/จำนวน/ราคา/ส่วนลด/หน่วย. → fills new `data` + `data.items`.

## FO edata body — data_value1..26 (extension_id = FO's, TBD)
**KEY:** `data_value2` = customer **CODE** (REG202604-9592), not auto id → maps to
`customer_ref` directly (if customer.code reuses the composite). `data_value1` = doc code
(also duplicated in `doc` table). `data_value10` = source CL ref (CL not migrated → keep as
data.legacyClRef or drop). `data_value26` = salesperson ("115_ชื่อ ตำแหน่ง" → store code/id).

Structural → sales_document: v1=doc no, v2=customer_ref, v10=src CL (legacy), v9/v20=doc
status, v26=salesperson/telesale.

Qualification fields → FO `data` (JSONB) keys (match to salesFields.ts FO when building):
v3 urgency(TS), v4 engagement(TS), v5 competition(TS), v6 coordinator-importance(TS),
v7 customer-type(TS), v8 note(TS), v9 doc-status(TS), v11 service-wanted, v12 need-desc,
v13 urgency(Sale), v14 engagement(Sale), v15 competition(Sale), v16 service-schedule,
v18 coordinator-importance(Sale), v19 plan-presented, v20 doc-status(Sale),
v21 close-probability(0-100), v22 closing-method, v23 expected-price, v24 should-offer-price,
v25 competitor-price. (v17 empty.)

## QT edata body — header (data_value*)
v1=doc code · v2=company-name-on-quote · v3=created date · **v5=customer code (REG…) →
customer_ref** (note: FO uses v2, QT uses v5!) · v7=services-offered · v8=total-offered ·
v11=service-wanted · v13=salesperson · v17/v29=payment terms · v19/v20=total before discount ·
v21=total+VAT · v22=closing method · v23=expected price · v24=QT note · v25=total after discount.

## QT line items (sub-table) → data.items
Rows where **`tempId` = QT header's data_id** (NOT main_id). Per item:
- v10 = บริการที่เสนอ → item.name
- v12 = ราคา → item.price
- v14 = ส่วนลด → item.discount
- v15 = จำนวน → item.qty
- v16 = หน่วย → item.unit
- v17 = ราคารวม → line total (new system computes; can store). code/serviceType empty.
→ pivot all such rows into new data.items = JSON-stringified array.

## chain (edge table) — relations: main_id=FO, relations_id=QT (both edata.data_id)
Separate table name + 2 doc_id columns (FO→QT→SO) → src_cl/src_fo/src_qt.

## Decisions
- new sales_document.code = reuse legacy doc code (continuity) or new? (idoc real-code column name?)
