import React, { useState } from 'react';
import { apiFetch } from '../utils/auth';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  IndianRupee, 
  Send,
  RefreshCw,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

function Dashboard({ stats, onNavigate, onAddToast, onDataChange }) {
  const [renewingStudent, setRenewingStudent] = useState(null);
  const [duration, setDuration] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rate, setRate] = useState('');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [feeStatus, setFeeStatus] = useState('Paid');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Retrieve seat capacity from localStorage (configured in settings)
  const totalCapacity = Number(localStorage.getItem('kanha_library_total_seats')) || 60;
  const occupancyRate = stats.occupiedSeats 
    ? Math.round((stats.occupiedSeats.length / totalCapacity) * 100) 
    : 0;

  // Filter students who are expired or expiring within 3 days
  const today = new Date();
  const warningThreshold = new Date();
  warningThreshold.setDate(today.getDate() + 3);

  // We will build a list of urgent alerts locally from the students database
  // in addition to backend calculations to ensure accuracy.
  const [allStudents, setAllStudents] = useState([]);
  
  React.useEffect(() => {
    apiFetch('/api/students')
      .then(res => res.json())
      .then(data => setAllStudents(data))
      .catch(err => console.error(err));
  }, [stats]);

  const urgentAlerts = allStudents.filter(student => {
    const expiry = new Date(student.expiry_date);
    const isExpired = expiry < today;
    const isExpiringSoon = expiry >= today && expiry <= warningThreshold;
    return isExpired || isExpiringSoon;
  });

  // WhatsApp click-to-chat pre-formatted link
  const handleWhatsAppSend = (student) => {
    const cleanPhone = student.whatsapp.replace(/\D/g, '');
    let phoneWithCountry = cleanPhone;
    if (cleanPhone.length === 10) {
      phoneWithCountry = '91' + cleanPhone; // Default to India country code
    }

    const expiryFormatted = new Date(student.expiry_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const isExpired = new Date(student.expiry_date) < new Date();
    const statusText = isExpired ? 'Expired 🔴' : 'Expiring Soon ⚠️';
    const pendingAmount = student.total_fees - student.amount_paid;

    const messageText = `*KANHA STUDY LIBRARY* 📚
----------------------------------
*Subscription Expiry Alert*

Dear *${student.name}*,

This is to notify you that your library seat subscription has ${isExpired ? 'expired' : 'approached its end date'}.

*Details:*
- Seat Number: *Seat ${student.seat_number}*
- Status: *${statusText}*
- Expiry Date: *${expiryFormatted}*
${pendingAmount > 0 ? `- Outstanding Fees: *₹${pendingAmount}*` : ''}

Please visit the front desk to renew your seat subscription for the upcoming month(s) and retain your workspace.

Thank you!
_Kanha Library Management_ 📖`;

    const url = `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
    onAddToast(`WhatsApp notification link opened for ${student.name}`, 'success');
  };

  // Open Quick Renew modal
  const openRenewModal = (student) => {
    setRenewingStudent(student);
    setDuration('1');
    // Set start date to tomorrow or today if already expired
    const nextStart = new Date(student.expiry_date);
    if (nextStart < new Date()) {
      setStartDate(new Date().toISOString().split('T')[0]);
    } else {
      nextStart.setDate(nextStart.getDate() + 1);
      setStartDate(nextStart.toISOString().split('T')[0]);
    }
    setRate(student.rate || '800'); // default rate or previous
    setDiscount('0');
    setAmountPaid(student.rate || '800');
    setFeeStatus('Paid');
    setRemarks('');
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const calculatedTotal = (Number(rate) * Number(duration)) - Number(discount);
    
    const renewalPayload = {
      duration: Number(duration),
      start_date: startDate,
      rate: Number(rate),
      discount: Number(discount),
      total_fees: calculatedTotal,
      fee_status: feeStatus,
      amount_paid: feeStatus === 'Paid' ? calculatedTotal : (feeStatus === 'Unpaid' ? 0 : Number(amountPaid)),
      remarks: remarks
    };

    try {
      const response = await apiFetch(`/api/students/${renewingStudent.id}/renew`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renewalPayload)
      });

      if (!response.ok) throw new Error('Renewal failed');
      
      onAddToast(`Subscription renewed successfully for ${renewingStudent.name}!`, 'success');
      
      // Fire celebration confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ff88', '#00b0ff', '#7928ca']
      });

      setRenewingStudent(null);
      onDataChange(); // Refresh stats
    } catch (err) {
      console.error(err);
      onAddToast('Failed to renew subscription. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <h2 className="view-title">Dashboard Overview</h2>
        <p className="view-subtitle">Monitor memberships, payments, and seat layouts</p>
      </div>

      {/* Stats Counter Grid */}
      <section className="stats-grid">
        <div className="glass stat-card active">
          <div className="stat-header">
            <span>Active Students</span>
            <CheckCircle color="var(--color-active)" />
          </div>
          <div className="stat-value">{stats.active}</div>
        </div>

        <div className="glass stat-card expired">
          <div className="stat-header">
            <span>Expired Accounts</span>
            <AlertTriangle color="var(--color-expired)" />
          </div>
          <div className="stat-value">{stats.expired}</div>
        </div>

        <div className="glass stat-card warning">
          <div className="stat-header">
            <span>Expiring (3 Days)</span>
            <Clock color="var(--color-warning)" />
          </div>
          <div className="stat-value">{stats.expiringSoon}</div>
        </div>

        <div className="glass stat-card">
          <div className="stat-header">
            <span>Seat Occupancy</span>
            <Users color="var(--color-info)" />
          </div>
          <div className="stat-value">
            {occupancyRate}% <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({stats.occupiedSeats ? stats.occupiedSeats.length : 0}/{totalCapacity})</span>
          </div>
        </div>

        <div className="glass stat-card">
          <div className="stat-header">
            <span>Collections (Total)</span>
            <IndianRupee color="var(--color-active)" />
          </div>
          <div className="stat-value">
            ₹{stats.revenue ? stats.revenue.toLocaleString('en-IN') : 0}
          </div>
        </div>
      </section>

      {/* Main Grid Panels */}
      <div className="dashboard-layout">
        {/* Urgent Alerts panel */}
        <section className="glass panel-card">
          <h3 className="panel-title" style={{ color: 'var(--color-expired)' }}>
            <AlertTriangle size={20} /> Subscription Expiry Alerts ({urgentAlerts.length})
          </h3>
          <div style={{ maxHeight: '420px', overflowY: 'auto', marginTop: '1rem' }}>
            {urgentAlerts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 1rem' }}>
                No memberships are expired or expiring soon.
              </div>
            ) : (
              urgentAlerts.map(student => {
                const daysLeft = Math.ceil(
                  (new Date(student.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
                );
                const isExpired = daysLeft < 0;

                return (
                  <div key={student.id} className="alert-item">
                    <div className="student-badge-info">
                      {student.photo_path ? (
                        <img 
                          src={student.photo_path} 
                          alt={student.name} 
                          className="student-avatar" 
                        />
                      ) : (
                        <div className="student-avatar-placeholder">
                          {student.name.charAt(0)}
                        </div>
                      )}
                      <div className="student-meta">
                        <h4>{student.name}</h4>
                        <p>
                          <span className="seat-tag">Seat {student.seat_number}</span>
                          <span className="status-indicator warning">
                            {isExpired ? 'Expired' : `${daysLeft} days left`}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-whatsapp" 
                        onClick={() => handleWhatsAppSend(student)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        title="Send WhatsApp Expiry Message"
                      >
                        <Send size={14} /> Send Alert
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => openRenewModal(student)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--color-active)', color: 'var(--color-active)' }}
                      >
                        <RefreshCw size={14} /> Renew
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Quick Actions Panel */}
        <section className="glass panel-card" style={{ minHeight: 'auto' }}>
          <h3 className="panel-title">Quick Tasks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('register')} style={{ width: '100%', padding: '1rem' }}>
              + Register New Student
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('seats')} style={{ width: '100%', padding: '1rem' }}>
              View Seat Layout Map
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('students')} style={{ width: '100%', padding: '1rem' }}>
              Open Student Directory
            </button>
          </div>
          
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontFamily: 'var(--font-header)', color: '#fff' }}>Quick Tip</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Configure your total library capacity under the **Settings** view in the sidebar. This updates the seat layout automatically.
            </p>
          </div>
        </section>
      </div>

      {/* Quick Renewal Modal */}
      {renewingStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: '#fff' }}>Renew Subscription</h3>
              <button className="modal-close" onClick={() => setRenewingStudent(null)}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Renewing subscription for <strong style={{ color: '#fff' }}>{renewingStudent.name}</strong> (Occupying Seat <strong>{renewingStudent.seat_number}</strong>).
            </p>

            <form onSubmit={handleRenewSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Duration (Months)</label>
                  <select 
                    className="form-control" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Monthly Rate (₹)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={rate} 
                    onChange={(e) => setRate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Discount Discount (₹)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={discount} 
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Fee Status</label>
                  <select 
                    className="form-control" 
                    value={feeStatus} 
                    onChange={(e) => setFeeStatus(e.target.value)}
                  >
                    <option value="Paid">Fully Paid</option>
                    <option value="Partial">Partially Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>

                {feeStatus === 'Partial' && (
                  <div className="form-group">
                    <label>Amount Paid Now (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={amountPaid} 
                      onChange={(e) => setAmountPaid(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Remarks</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={remarks} 
                  placeholder="e.g. Paid online, seat extension"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'right' }}>
                <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem', float: 'left', marginTop: '0.5rem' }}>
                  Total: ₹{(Number(rate) * Number(duration)) - Number(discount)}
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => setRenewingStudent(null)} style={{ marginRight: '0.75rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;


