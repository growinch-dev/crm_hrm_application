import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import FormModal from '../components/FormModal';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency, formatDate } from '../utils/format';

const dealFields = [
  { key: 'name', label: 'Deal Name', type: 'text', required: true },
  { key: 'company_id', label: 'Company', type: 'select-async', optionsEndpoint: '/crm/companies' },
  { key: 'contact_id', label: 'Contact', type: 'select-async', optionsEndpoint: '/crm/contacts', optionsLabel: 'first_name' },
  { key: 'stage_id', label: 'Stage', type: 'select-async', optionsEndpoint: '/meta/pipeline-stages' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'probability', label: 'Probability %', type: 'number' },
  { key: 'expected_close_date', label: 'Expected Close Date', type: 'date' },
  { key: 'owner_id', label: 'Owner', type: 'select-async', optionsEndpoint: '/users' },
];

export default function DealsPipeline() {
  const canEdit = useCanEdit();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/deals/view/pipeline');
      setBoard(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (payload) => {
    if (editingDeal) await api.put(`/crm/deals/${editingDeal.id}`, payload);
    else await api.post('/crm/deals', payload);
    setModalOpen(false);
    setEditingDeal(null);
    load();
  };

  const moveDeal = async (deal, direction) => {
    const stages = board.map((s) => s.id);
    const idx = stages.indexOf(deal.stage_id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= stages.length) return;
    await api.put(`/crm/deals/${deal.id}`, { stage_id: stages[newIdx] });
    load();
  };

  const totalOpenValue = board.reduce((sum, s) => sum + s.deals.reduce((a, d) => a + Number(d.amount || 0), 0), 0);

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Sales Pipeline</h1>
          <p className="desc">Deals grouped by stage &middot; {formatCurrency(totalOpenValue)} total open value</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => { setEditingDeal(null); setModalOpen(true); }}>+ New Deal</button>}
      </div>

      {loading ? (
        <div className="loading-row">Loading pipeline…</div>
      ) : (
        <div className="kanban-board">
          {board.map((stage) => (
            <div className="kanban-col" key={stage.id}>
              <div className="kanban-col-head">
                <span className="title">{stage.name}</span>
                <span className="count">{stage.deals.length} · {formatCurrency(stage.deals.reduce((a, d) => a + Number(d.amount || 0), 0))}</span>
              </div>
              {stage.deals.length === 0 && <div className="faint" style={{ fontSize: 12, padding: '8px 4px' }}>No deals</div>}
              {stage.deals.map((deal) => (
                <div className="kanban-card" key={deal.id}>
                  <div className="name">{deal.name}</div>
                  <div className="amount">{formatCurrency(deal.amount)}</div>
                  <div className="meta">{deal.company_name || 'No company'} {deal.expected_close_date ? `· ${formatDate(deal.expected_close_date)}` : ''}</div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => moveDeal(deal, -1)}>←</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => moveDeal(deal, 1)}>→</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingDeal(deal); setModalOpen(true); }}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <FormModal
          title={editingDeal ? 'Edit Deal' : 'New Deal'}
          fields={dealFields}
          initialData={editingDeal}
          onClose={() => { setModalOpen(false); setEditingDeal(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
