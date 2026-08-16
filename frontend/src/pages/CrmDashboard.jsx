import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { formatCurrency } from '../utils/format';

const PIE_COLORS = ['#2E5BFF', '#3FAE3A', '#B8791C', '#C4433A', '#6E4FCC', '#9AA1B1'];

export default function CrmDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/crm/dashboard/summary').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  if (!data) return <div className="content"><div className="loading-row">Loading dashboard…</div></div>;

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>CRM Dashboard</h1>
          <p className="desc">A snapshot of leads, pipeline, and support across the business.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Leads" value={data.totalLeads} />
        <StatCard label="Open Deals" value={data.openDeals} sub={formatCurrency(data.openPipelineValue) + ' in pipeline'} />
        <StatCard label="Won Deals" value={data.wonDeals} sub={formatCurrency(data.totalRevenue) + ' revenue'} />
        <StatCard label="Open Tickets" value={data.openTickets} />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Deals by Stage</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.dealsByStage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2E5BFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad">
          <div className="section-title">Leads by Status</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.leadsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label>
                {data.leadsByStatus.map((entry, idx) => <Cell key={entry.status} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
