-- รองรับการกรอง "ลูกค้าที่ยังไม่อยู่ในตะกร้าของฉัน" (anti-join basket_item ตาม customer_ref)
create index if not exists idx_basket_item_customer on basket_item (customer_ref);
