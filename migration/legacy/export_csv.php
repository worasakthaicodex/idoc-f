<?php
/**
 * export_csv.php — สตรีมตารางระบบเก่าออกเป็น CSV (chunk แบบ keyset) · single connection ($db2)
 *   ?key=TOKEN&list=1            -> ลิสต์ตาราง + จำนวนแถว
 *   ?key=TOKEN&table=register   -> สตรีม CSV  (curl -o register.csv "...")
 * **ลบไฟล์นี้ทิ้งทันทีหลังย้ายเสร็จ**
 */
$KEY = 'PUT_A_LONG_RANDOM_TOKEN_change_me';
if (!isset($_GET['key']) || $_GET['key'] !== $KEY) { header('HTTP/1.1 403 Forbidden'); exit('no'); }

set_time_limit(0); ini_set('max_execution_time', 0); ini_set('memory_limit', '1024M');
while (ob_get_level()) { ob_end_clean(); }

$db2 = new mysqli('127.0.0.1', 'USER', 'PASS', 'DB_NAME');   // คอนเนกชันเดียว (qt_description ถูกก๊อปเข้ามาแล้ว)
if ($db2->connect_errno) { header('HTTP/1.1 500'); exit('db connect failed'); }
$db2->set_charset('utf8mb4');   // <-- ถ้าไทยเพี้ยน ลองเปลี่ยนเป็น 'tis620' / 'latin1'

// ตาราง => primary key (เลข auto สำหรับ keyset chunk)
$TABLES = array(
    'register'       => 'id',
    'edata'          => 'data_id',
    'idoc'           => 'id',
    'doc'            => 'doc_id',
    'relations'      => 'id',
    'qt_description' => 'id',   // <-- แก้ pk ให้ตรง (รายการ/ราคา QT เก่า)
    'qt'             => 'id',   // หัว QT เก่า (id_fo, id_doc=SO)
    'qt2'            => 'id',   // หัว QT เก่า (ชุดที่หลงเหลือ — id_fo=0 ใช้ id_refer แทน)
    'calendar'       => 'id',   // ปฏิทิน/นัดหมาย (index_id=register.id, eform_id=edata.data_id, by_name)
);

if (isset($_GET['list'])) {
    header('Content-Type: text/plain; charset=utf-8');
    foreach ($TABLES as $tn => $pk) {
        $r = $db2->query("SELECT COUNT(*) c FROM `$tn`");
        $c = $r ? $r->fetch_assoc() : array('c' => 'ERR');
        echo $tn . "\t" . $c['c'] . "\n";
    }
    exit;
}
$t = isset($_GET['table']) ? $_GET['table'] : '';
if (!isset($TABLES[$t])) { header('HTTP/1.1 400 Bad Request'); exit('bad table'); }
$pk = $TABLES[$t];

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $t . '.csv"');
$out = fopen('php://output', 'w');   // ไม่ใส่ BOM

$last = 0; $chunk = 2000; $hd = false;
while (true) {
    $res = $db2->query("SELECT * FROM `$t` WHERE `$pk` > $last ORDER BY `$pk` ASC LIMIT $chunk");
    if (!$res || $res->num_rows == 0) { break; }
    while ($row = $res->fetch_assoc()) {
        if (!$hd) { fputcsv($out, array_keys($row)); $hd = true; }
        $vals = array();
        foreach ($row as $v) { $vals[] = ($v === null) ? '\\N' : $v; }
        fputcsv($out, $vals);
        $last = (int) $row[$pk];
    }
    $res->free();
    flush();
}
$db2->close();
