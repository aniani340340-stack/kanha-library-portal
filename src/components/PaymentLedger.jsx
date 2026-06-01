import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/auth';
import { Search, DollarSign, Calendar, Smile, RefreshCw } from 'lucide-react';

function PaymentLedger({ onAddToast }) {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/payments');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
      onAddToast('Could not load payment ledger.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.seatNumber.toString().includes(searchTerm) ||
      (p.remarks || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMonth = monthFilter === 'All' || p.month === monthFilter;

    return matchesSearch && matchesMonth;
  });

  // Calculate total collection for the filtered list
  const totalRupees = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Group payments by date (day-to-day)
  const groupedPayments = filteredPayments.reduce((groups, p) => {
    const date = p.paid_on || 'Unknown Date';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(p);
    return groups;
  }, {});

  // Sort dates descending
  const sortedDates = Object.keys(groupedPayments).sort((a, b) => new Date(b) - new Date(a));

  // Extract unique months for the filter dropdown
  const uniqueMonths = Array.from(new Set(payments.map((p) => p.month))).filter(Boolean).sort();

  return (
    <div>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="view-title">Payment Ledger</h2>
          <p className="view-subtitle">Day-to-day collection records and transaction details</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchPayments} style={{ height: 'fit-content' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary dashboard card for total collection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass stat-card active" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem', borderRadius: '12px' }}>
          <div className="stat-header">
            <span>Total Collection (Ruppes)</span>
            <DollarSign color="var(--color-active)" />
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', color: 'var(--color-active)' }}>
            ₹{totalRupees}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Sum of all transactions for matching search/filters ({filteredPayments.length} record{filteredPayments.length !== 1 ? 's' : ''})
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <section className="glass panel-card" style={{ minHeight: 'auto', marginBottom: '2rem', padding: '1.25rem' }}>
        <div className="filters-bar" style={{ margin: 0 }}>
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="form-control"
              placeholder="Search by student, seat, or remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Filter Month:</label>
            <select
              className="form-control"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="All">All Months</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Day-to-day Records list */}
      <section className="glass panel-card" style={{ padding: '1.5rem' }}>
        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
            Loading ledger...
          </div>
        ) : sortedDates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '5rem 1rem' }}>
            <Smile size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No payment records found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {sortedDates.map((date) => {
              const dateObj = new Date(date);
              const formattedDate = isNaN(dateObj.getTime())
                ? date
                : dateObj.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });

              const dayTotal = groupedPayments[date].reduce((sum, p) => sum + Number(p.amount || 0), 0);

              return (
                <div key={date} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px dashed rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontWeight: 'bold' }}>
                      <Calendar size={16} color="var(--color-active)" />
                      <span>{formattedDate}</span>
                    </div>
                    <div style={{ color: 'var(--color-active)', fontWeight: '800', fontSize: '1.1rem' }}>
                      Day Total: ₹{dayTotal}
                    </div>
                  </div>

                  <div className="students-table-container">
                    <table className="students-table" style={{ background: 'transparent' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem 1rem' }}>Student</th>
                          <th style={{ padding: '0.5rem 1rem' }}>Seat</th>
                          <th style={{ padding: '0.5rem 1rem' }}>Phone</th>
                          <th style={{ padding: '0.5rem 1rem' }}>Target Month</th>
                          <th style={{ padding: '0.5rem 1rem' }}>Remarks</th>
                          <th style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedPayments[date].map((p, idx) => (
                          <tr key={`${date}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '0.75rem 1rem', color: '#fff', fontWeight: '500' }}>
                              {p.studentName}
                              {p.archived && <span className="seat-tag" style={{ marginLeft: '0.5rem', background: 'rgba(255,56,96,0.15)', color: 'var(--color-expired)', border: 'none' }}>Archived</span>}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="seat-tag">Seat {p.seatNumber}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{p.phone}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{p.month}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {p.remarks || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-active)', fontSize: '1.05rem' }}>
                              ₹{p.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default PaymentLedger;
