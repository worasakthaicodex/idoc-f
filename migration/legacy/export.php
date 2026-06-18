<?php
/**
 * export.php — สคริปต์ดึงข้อมูลจากระบบเก่า (PHP/MySQL บน Win7) ออกเป็น CSV
 * วางไว้ที่ web root ของ Win7 แล้วเรียกผ่าน HTTP จากเครื่องที่ต่อ Postgres ได้
 *
 *   ?key=TOKEN&list=1                 -> ลิสต์ตารางที่อนุญาต + จำนวนแถวแต่ละตัว (ไว้เช็คครบ)
 *   ?key=TOKEN&table=idoc&count=1     -> คืนจำนวนแถว (ไว้เทียบกับ wc -l ของ CSV)
 *   ?key=TOKEN&table=idoc            -> สตรีม CSV ทั้งตาราง (SELECT * + แถวหัวคอลัมน์)
 *   ?key=TOKEN&table=edata&limit=50000&offset=0&order=id   -> ดึงเป็นก้อน (ตารางใหญ่)
 *
 * ความปลอดภัย: ใส่ token สุ่มยาว · whitelist เฉพาะตารางที่ต้องย้าย · **ลบไฟล์นี้ทิ้งทันทีหลังย้ายเสร็จ**
 */
set_time_limit(0);
while (ob_get_level()) { ob_end_clean(); }

$KEY = 'PUT_A_LONG_RANDOM_TOKEN_HERE_change_me';                 // <-- เปลี่ยนเป็นสุ่มยาวๆ
$DB  = array('host' => '127.0.0.1', 'user' => 'root', 'pass' => '', 'name' => 'YOUR_DB_NAME');
// ใส่ชื่อตารางจริงทั้ง ~10 ตัว (customer / call log / comm log / idoc / edata / edge table / ...)
$ALLOW = array('idoc', 'edata', 'customer', 'call_log', 'comm_log');

if (!isset($_GET['key']) || $_GET['key'] !== $KEY) { header('HTTP/1.1 403 Forbidden'); exit('no'); }

$m = new mysqli($DB['host'], $DB['user'], $DB['pass'], $DB['name']);
if ($m->connect_errno) { header('HTTP/1.1 500'); exit('db connect failed'); }
$m->set_charset('utf8mb4');   // <-- ถ้าไทยเพี้ยนใน CSV ลองเปลี่ยนเป็น 'tis620' หรือ 'latin1'

// ลิสต์ตาราง + count (ตรวจครบ)
if (isset($_GET['list'])) {
    header('Content-Type: text/plain; charset=utf-8');
    foreach ($ALLOW as $tname) {
        $r = $m->query('SELECT COUNT(*) c FROM `' . $tname . '`');
        $c = $r ? $r->fetch_assoc() : array('c' => 'ERR');
        echo $tname . "\t" . $c['c'] . "\n";
    }
    exit;
}

$t = isset($_GET['table']) ? $_GET['table'] : '';
if (!in_array($t, $ALLOW, true)) { header('HTTP/1.1 400 Bad Request'); exit('bad table'); }

// แค่ count
if (isset($_GET['count'])) {
    $r = $m->query('SELECT COUNT(*) c FROM `' . $t . '`')->fetch_assoc();
    header('Content-Type: text/plain'); exit($r['c']);
}

// build query (+ chunk ถ้ามี limit)
$sql = 'SELECT * FROM `' . $t . '`';
if (isset($_GET['limit'])) {
    $lim = (int) $_GET['limit'];
    $off = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
    $ord = isset($_GET['order']) ? preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['order']) : '';
    if ($ord !== '') { $sql .= ' ORDER BY `' . $ord . '`'; }   // chunk ต้อง order ด้วยคอลัมน์ id ที่นิ่ง
    $sql .= ' LIMIT ' . $lim . ' OFFSET ' . $off;
}

$m->query('SET SESSION net_write_timeout=600');
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $t . '.csv"');
$out = fopen('php://output', 'w');   // ไม่ใส่ BOM (BOM ทำให้ Postgres \copy หัวคอลัมน์เพี้ยน)

$res = $m->query($sql, MYSQLI_USE_RESULT);   // unbuffered — ดึงทีละแถว ไม่อมทั้งตารางในแรม (ไม่โดน phpMyAdmin ตัด)
$cols = array();
foreach ($res->fetch_fields() as $f) { $cols[] = $f->name; }
fputcsv($out, $cols);
while ($row = $res->fetch_assoc()) {
    fputcsv($out, array_map(function ($v) { return $v === null ? '\\N' : $v; }, $row));
}
fclose($out);
