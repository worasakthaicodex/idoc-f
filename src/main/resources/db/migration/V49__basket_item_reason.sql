-- เหตุผลที่นำลูกค้ารายนี้ใส่ตะกร้า + วันที่ต้องหยิบออก (เตือน/หมดอายุในตะกร้า)
alter table basket_item add column reason     varchar(255);
alter table basket_item add column remove_by  date;
