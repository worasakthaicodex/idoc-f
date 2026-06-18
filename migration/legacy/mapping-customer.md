# Phase 1 mapping — legacy `register` → new `customer`

New `customer` real columns: `code`, `name`, `status` (enum), `group_name`, `company_id`,
`attributes` (JSONB). Everything else → `attributes` with the keys from
`customerFields.ts` (CUST_FIELDS) so it renders in the customer form/detail.

## Special / real columns
| legacy `register.*` | → new | note |
|---|---|---|
| `id` (auto) | `attributes.legacyId` | **ANCHOR** — this is the id_refer that logs/docs point to |
| `register_code` + `register_daterun` + '-' + `register_id` | `code` | composite legacy customer code (reuse for continuity; varchar(30) — widen if longer) |
| `register_name` | `name` (real col) | |
| `register_groups` | `group_name` (real col) | values อาหาร/ยา/… already align with groupName opts |
| `register_status` | `status` (enum) | **value-map needed** → CustomerStatus (ACTIVE / INFORMATION_INCOMPLETE / NO_INTEREST / LEGAL_HOLD / BLACKLISTED / BUSINESS_CLOSED). DISTINCT values TBD |
| `date_insert_oldsys` | `created_at` (BaseEntity) | preserve original registration date; also keep in attributes.legacyInsertedAt |
| `register_type` (="ลูกค้า") | — | skip (new system split customer/partner into modules) |
| `revision` | `attributes.legacyRevision` | optional; new system tracks revisions separately |

## attributes (key = CUST_FIELDS key)
| legacy | → attributes key |
|---|---|
| `register_title` | `registerTitle` (บจก/บมจ/หจก… aligns with opts) |
| `party_type` | `partyType` |
| `business_type` | `businessType` |
| `product_category` | `productCategory` |
| `phone_number` | `phone` |
| `mobile_number` | `mobile` |
| `register_email` | `email` |
| `fax` | `fax` |
| `website` | `website` |
| `social` | `social` |
| `contact_person` | `contactPerson` |
| `person_position` | `personPosition` |
| `person_number` | `personNumber` |
| `person_email` | `personEmail` |
| `register_fulladdress` | `addressFull` (combined string; structured parse optional/later) |
| `register_address` | `address` (house no / building) |
| `region` | `region` (normalize to region opts) |
| `tax_id` | `taxId` |
| `dbd` | `dbd` |
| `branch_code` | `branchCode` |
| `payment_terms` | `paymentTerms` (normalize to opts) |
| `credit_limit` | `creditLimit` |
| `bank_account` | `bankAccount` |
| `preferred_currency` | `preferredCurrency` |
| `register_note` | `note` |
| `contact_approvers` | `approverName` |
| `approvers_position` | `approverPosition` |
| `approvers_number` | `approverPhone` |
| `approvers_email` | `approverEmail` |

New fields with no legacy source → left empty: grade, categorization, behavior, point,
lat, lon, capital, headcount, horsepower, otherConditions.

## Decisions to confirm
1. `code` = reuse legacy composite (continuity) — OK? (vs generate new REG codes)
2. Confirm `register.id` is exactly the `id_refer` value stored in the call/comm logs.
3. DISTINCT `register_status` values → CustomerStatus enum map.
