import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/client';
import { formatDateTime } from '../utils/format';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch {
      // notifications aren't critical to the rest of the app - fail silently
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const res = await api.get('/notifications');
      setRows(res.data.data);
    }
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`);
      setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const markAllRead = async (e) => {
    e.stopPropagation();
    await api.post('/notifications/read-all');
    setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
    setUnreadCount(0);
  };

  const clearAll = async (e) => {
    e.stopPropagation();
    await api.delete('/notifications/clear-all');
    setRows([]);
    setUnreadCount(0);
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="btn btn-ghost btn-sm notif-bell" onClick={toggleOpen} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {unreadCount > 0 && <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>}
              {rows.length > 0 && <button className="notif-mark-all" onClick={clearAll}>Clear all</button>}
            </div>
          </div>
          <div className="notif-dropdown-list">
            {rows.length === 0 && <div className="empty-state" style={{ padding: '24px 0' }}>No notifications yet.</div>}
            {rows.map((n) => (
              <div key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => handleClick(n)}>
                <div className="notif-item-title">{n.title}</div>
                {n.body && <div className="notif-item-body">{n.body}</div>}
                <div className="notif-item-time">{formatDateTime(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
