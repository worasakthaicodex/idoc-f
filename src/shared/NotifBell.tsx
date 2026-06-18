import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "./icons";
import { getNotifs, subscribeNotifs, isNotifRead, markNotifRead, markAllNotifsRead, unreadCount, type AppNotif } from "./notifications";

/**
 * กระดิ่งแจ้งเตือน — รวมจากทุก provider · มีตัวเลขเมื่อมีของรอ · กดดูรายการ → เด้งไปเปิด
 */
export default function NotifBell() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState<AppNotif[]>(() => getNotifs());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeNotifs(() => setItems(getNotifs())), []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (n: AppNotif) => { markNotifRead(n.id); setOpen(false); if (n.to) nav(n.to); };
  const n = items.length;
  const unread = unreadCount();   // ตัวเลขกระดิ่ง = ยังไม่ได้อ่าน

  return (
    <div className="notif" ref={ref}>
      <div className="ic notif-bell" title={t("notif.title")} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="notif-dot">{unread > 99 ? "99+" : unread}</span>}
      </div>
      {open && (
        <div className="notif-pop">
          <div className="notif-head">{t("notif.title")}{unread > 0 ? ` (${unread})` : ""}
            {unread > 0 && <span className="notif-readall" onClick={(e) => { e.stopPropagation(); markAllNotifsRead(); }}>{t("notif.markAllRead", { defaultValue: "อ่านทั้งหมด" })}</span>}
          </div>
          {n === 0 ? (
            <div className="notif-empty">{t("notif.empty")}</div>
          ) : (
            <div className="notif-list">
              {items.map((it) => {
                const agg = it.kind === "calFollowups";
                return (
                  <div key={it.id} className={`notif-item${isNotifRead(it.id) ? " read" : ""}`} onClick={() => go(it)}>
                    <div className="notif-kind">{t(`notif.kind.${it.kind}`, { defaultValue: t("notif.title") })}</div>
                    <div className="notif-main">{agg ? t("notif.followupsText", { count: it.primary }) : it.primary}</div>
                    {it.secondary && <div className="notif-sub">{agg ? t("notif.followupsOverdue", { count: it.secondary }) : it.secondary}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="notif-foot" onClick={() => { setOpen(false); nav("/inbox"); }}>
            {t("notif.all", { defaultValue: "ดูทั้งหมด & ปฏิทิน" })}
          </div>
        </div>
      )}
    </div>
  );
}
