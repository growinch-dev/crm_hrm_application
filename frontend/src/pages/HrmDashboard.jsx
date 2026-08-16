import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { formatDate } from '../utils/format';

export default function HrmDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/hrm/dashboard/summary').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  if (!data) return <div className="content"><div className="loading-row">Loading dashboard…</div></div>;

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>HR Dashboard</h1>
          <p className="desc">Headcount, hiring, leave, and attendance at a glance.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Employees" value={data.totalEmployees} sub={`${data.activeEmployees} active`} />
        <StatCard label="Open Positions" value={data.openPositions} />
        <StatCard label="Pending Leave Requests" value={data.pendingLeaves} />
        <StatCard label="Present Today" value={data.presentToday} />
        <StatCard label="Pending Expense Claims" value={data.pendingExpenses} />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Employees by Department</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.employeesByDept}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3E5FCC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <div className="section-title">Upcoming Holidays</div>
          {data.upcomingHolidays.length === 0 && <p className="muted">No upcoming holidays scheduled.</p>}
          {data.upcomingHolidays.map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{h.name}</span>
              <span className="muted mono" style={{ fontSize: 12.5 }}>{formatDate(h.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
