import React, { useState } from 'react';
import { apiFetch } from '../utils/auth';
import { 
  Search, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Send, 
  X, 
  MessageCircle,
  Calendar,
  DollarSign,
  AlertTriangle,
  Smile,
  Edit2
} from 'lucide-react';
import confetti from 'canvas-confetti';

function StudentList({ students, onAddToast, onDataChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Check if navigating from SeatLayout to view a specific student
  React.useEffect(() => {
    const query = sessionStorage.getItem('search_student_query');
    if (query) {
      setSearchTerm(query);
      sessionStorage.removeItem('search_student_query');
    }
  }, []);
  
  // Modal states
  const [selectedStudent, setSelectedStudent] = useState(null); // for Details modal
  const [renewingStudent, setRenewingStudent] = useState(null); // for Renew modal
  const [deletingStudent, setDeletingStudent] = useState(null); // for Delete modal
  const [editStudent, setEditStudent] = useState(null); // for Edit modal
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editSeatNumber, setEditSeatNumber] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  
  // Renewal modal form states
  const [duration, setDuration] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rate, setRate] = useState('');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [feeStatus, setFeeStatus] = useState('Paid');
  const [seatType, setSeatType] = useState('morning');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync renewal amountPaid dynamically
  const calculatedTotal = (Number(rate) * Number(duration)) - Number(discount);
  React.useEffect(() => {
    if (feeStatus === 'Paid') {
      setAmountPaid(calculatedTotal.toString());
    } else if (feeStatus === 'Unpaid') {
      setAmountPaid('0');
    }
  }, [feeStatus, rate, duration, discount]);

  // Expiry dates helper
  const today = new Date();
  const warningThreshold = new Date();
  warningThreshold.setDate(today.getDate() + 3);

  // Filter & Search logic
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm) ||
      student.whatsapp.includes(searchTerm) ||
      student.seat_number.toString().includes(searchTerm);
      
    if (!matchesSearch) return false;

    const expiry = new Date(student.expiry_date);
    const isExpired = expiry < today;
    const isExpiringSoon = expiry >= today && expiry <= warningThreshold;

    if (statusFilter === 'All') return true;
    if (statusFilter === 'Active') return !isExpired && !isExpiringSoon;
    if (statusFilter === 'Expired') return isExpired;
    if (statusFilter === 'Expiring Soon') return isExpiringSoon;
    if (statusFilter === 'Pending Fees') return (student.total_fees - student.amount_paid) > 0;

    return true;
  });

  // Action: Open Renew Modal
  const openRenewModal = (student) => {
    setRenewingStudent(student);
    setDuration('1');
    const nextStart = new Date(student.expiry_date);
    if (nextStart < new Date()) {
      setStartDate(new Date().toISOString().split('T')[0]);
    } else {
      nextStart.setDate(nextStart.getDate() + 1);
      setStartDate(nextStart.toISOString().split('T')[0]);
    }
    setRate(student.rate || '800');
    setDiscount('0');
    setAmountPaid(student.rate || '800');
    setFeeStatus('Paid');
    setSeatType(student.seat_type || student.seat_time || 'morning');
    setRemarks('');
  };

  const openEditModal = (student) => {
    setEditStudent(student);
    setEditName(student.name);
    setEditPhone(student.phone);
    setEditWhatsApp(student.whatsapp);
    setEditSeatNumber(student.seat_number);
    setEditParentPhone(student.parent_phone || '');
    setEditStartDate(student.start_date || new Date().toISOString().split('T')[0]);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const editPayload = {
      ...editStudent,
      name: editName,
      phone: editPhone,
      whatsapp: editWhatsApp,
      seat_number: editSeatNumber,
      parent_phone: editParentPhone,
      start_date: editStartDate
    };
    try {
      const response = await apiFetch(`/api/students/${editStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload)
      });
      if (!response.ok) throw new Error('Edit failed');
      onAddToast(`Student ${editName} updated successfully!`, 'success');
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      setEditStudent(null);
      onDataChange();
    } catch (err) {
      console.error(err);
      onAddToast('Failed to update student.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const renewalPayload = {
      duration: Number(duration),
      start_date: startDate,
      seat_type: seatType,
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
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ff88', '#00b0ff', '#7928ca']
      });

      setRenewingStudent(null);
      onDataChange();
    } catch (err) {
      console.error(err);
      onAddToast('Failed to renew subscription.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Delete Student
  const handleDeleteSubmit = async () => {
    try {
      const response = await apiFetch(`/api/students/${deletingStudent.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Deletion failed');
      onAddToast(`${deletingStudent.name} moved to Deleted Students archive.`, 'success');
      setDeletingStudent(null);
      onDataChange();
    } catch (err) {
      console.error(err);
      onAddToast('Failed to delete student.', 'error');
    }
  };

  // WhatsApp Alert Link generator
  const handleWhatsAppSend = (student) => {
    const cleanPhone = student.whatsapp.replace(/\D/g, '');
    let phoneWithCountry = cleanPhone;
    if (cleanPhone.length === 10) {
      phoneWithCountry = '91' + cleanPhone;
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
  };

  return (
    <div>
      <div className="view-header">
        <h2 className="view-title">Student Directory</h2>
        <p className="view-subtitle">Manage student database, fee status, and seat configurations</p>
      </div>

      {/* Search and Filters panel */}
      <section className="glass panel-card" style={{ minHeight: 'auto', marginBottom: '2rem', padding: '1.25rem' }}>
        <div className="filters-bar">
          <div className="search-input-wrapper">
            <Search />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by name, phone, seat..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-pills">
            <div 
              className={`filter-pill ${statusFilter === 'All' ? 'active' : ''}`}
              onClick={() => setStatusFilter('All')}
            >
              All Students ({students.length})
            </div>
            <div 
              className={`filter-pill pill-active ${statusFilter === 'Active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Active')}
            >
              Active
            </div>
            <div 
              className={`filter-pill pill-expired ${statusFilter === 'Expired' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Expired')}
            >
              Expired
            </div>
            <div 
              className={`filter-pill pill-warning ${statusFilter === 'Expiring Soon' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Expiring Soon')}
            >
              Expiring Soon
            </div>
            <div 
              className={`filter-pill pill-warning ${statusFilter === 'Pending Fees' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Pending Fees')}
            >
              Pending Fees
            </div>
          </div>
        </div>
      </section>

      {/* Directory Table Grid */}
      <section className="glass panel-card" style={{ padding: '0' }}>
        {filteredStudents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '5rem 1rem' }}>
            <Smile size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No students found matching current search filters.</p>
          </div>
        ) : (
          <div className="students-table-container">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Seat</th>
                  <th>Contact Info</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Fee Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => {
                  const daysLeft = Math.ceil(
                    (new Date(student.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpired = daysLeft < 0;
                  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 3;
                  
                  const pendingFee = student.total_fees - student.amount_paid;

                  return (
                    <tr key={student.id}>
                      {/* Avatar & Name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {student.photo_path ? (
                            <img 
                              src={student.photo_path} 
                              alt={student.name} 
                              className="student-avatar" 
                              style={{ width: '40px', height: '40px' }}
                            />
                          ) : (
                            <div className="student-avatar-placeholder" style={{ width: '40px', height: '40px', fontSize: '0.9rem' }}>
                              {student.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span style={{ fontWeight: '600', color: '#fff' }}>{student.name}</span>
                          </div>
                        </div>
                      </td>
                      
                      {/* Seat */}
                      <td>
                        <span className="seat-tag">Seat {student.seat_number}</span>
                      </td>

                      {/* Contact */}
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <div>P: {student.phone}</div>
                          <div style={{ color: 'var(--text-muted)' }}>WA: {student.whatsapp}</div>
                        </div>
                      </td>

                      {/* Expiry */}
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                          {new Date(student.expiry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td>
                        {isExpired ? (
                          <span className="status-indicator expired">Expired</span>
                        ) : isExpiringSoon ? (
                          <span className="status-indicator warning">Expiring</span>
                        ) : (
                          <span className="status-indicator active">Active</span>
                        )}
                      </td>

                      {/* Fees */}
                      <td>
                        {student.fee_status === 'Paid' ? (
                          <span className="status-indicator active">Paid</span>
                        ) : student.fee_status === 'Partial' ? (
                          <span className="status-indicator warning" title={`Pending: ₹${pendingFee}`}>
                            Partial (₹{pendingFee})
                          </span>
                        ) : (
                          <span className="status-indicator expired" title={`Pending: ₹${pendingFee}`}>
                            Unpaid (₹{pendingFee})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                            onClick={() => setSelectedStudent(student)}
                            title="View Student Profile"
                          >
                            <Eye size={15} />
                          </button>
                          
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--color-active)', borderColor: 'rgba(0, 255, 136, 0.2)' }}
                            onClick={() => openRenewModal(student)}
                            title="Renew Membership"
                          >
                            <RefreshCw size={15} />
                          </button>

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                            onClick={() => openEditModal(student)}
                            title="Edit Student Details"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button 
                            className="btn btn-whatsapp" 
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                            onClick={() => handleWhatsAppSend(student)}
                            title="Send WhatsApp Message"
                          >
                            <Send size={15} />
                          </button>

                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.35rem', borderRadius: '6px' }}
                            onClick={() => setDeletingStudent(student)}
                            title="Delete Student"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 1. Student Details Profile Modal */}
      {selectedStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: '#fff' }}>Student Profile</h3>
              <button className="modal-close" onClick={() => setSelectedStudent(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="detail-grid">
              <div>
                {selectedStudent.photo_path ? (
                  <img 
                    src={selectedStudent.photo_path} 
                    alt={selectedStudent.name} 
                    className="detail-photo" 
                  />
                ) : (
                  <div className="detail-no-photo">
                    <Smile size={32} style={{ marginBottom: '0.5rem' }} />
                    No photo captured
                  </div>
                )}
                <span className="seat-tag" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', padding: '0.5rem', fontSize: '1rem' }}>
                  Seat Number: {selectedStudent.seat_number}
                </span>
              </div>

              <div>
                <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '1.25rem', color: '#fff', marginBottom: '1rem' }}>
                  {selectedStudent.name}
                </h4>

                <div className="detail-info-grid">
                  <div className="detail-field">
                    <h5>Primary Phone</h5>
                    <p>{selectedStudent.phone}</p>
                  </div>
                  <div className="detail-field">
                    <h5>WhatsApp Number</h5>
                    <p>{selectedStudent.whatsapp}</p>
                  </div>
                  <div className="detail-field">
                    <h5>Parent / Emergency Contact</h5>
                    <p>{selectedStudent.parent_phone || 'Not provided'}</p>
                  </div>
                  <div className="detail-field">
                    <h5>Status</h5>
                    <p>
                      <span className={`status-indicator ${selectedStudent.expiry_date < new Date().toISOString().split('T')[0] ? 'expired' : 'active'}`}>
                        {selectedStudent.expiry_date < new Date().toISOString().split('T')[0] ? 'Expired' : 'Active'}
                      </span>
                    </p>
                  </div>
                </div>

                <h5 style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Billing & Plan Details
                </h5>

                <div className="detail-info-grid">
                  <div className="detail-field">
                    <h5>Plan Duration</h5>
                    <p>{selectedStudent.duration} Month(s)</p>
                  </div>
                  <div className="detail-field">
                    <h5>Plan Validity</h5>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      {selectedStudent.start_date} to {selectedStudent.expiry_date}
                    </p>
                  </div>
                  <div className="detail-field">
                    <h5>Fee Charged</h5>
                    <p>₹{selectedStudent.total_fees} (Rate: ₹{selectedStudent.rate}/mo, Disc: ₹{selectedStudent.discount})</p>
                  </div>
                  <div className="detail-field">
                    <h5>Amount Paid</h5>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <DollarSign size={14} color="var(--color-active)" />
                      ₹{selectedStudent.amount_paid} ({selectedStudent.fee_status})
                    </p>
                  </div>
                </div>

                {selectedStudent.remarks && (
                  <div className="detail-field" style={{ marginTop: '1rem' }}>
                    <h5>Remarks</h5>
                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{selectedStudent.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-whatsapp" onClick={() => handleWhatsAppSend(selectedStudent)}>
                <MessageCircle size={16} /> WhatsApp Chat
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedStudent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Renewal Modal */}
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
              Extending validity for <strong style={{ color: '#fff' }}>{renewingStudent.name}</strong> at Seat <strong style={{ color: '#fff' }}>{renewingStudent.seat_number}</strong>.
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
                  <label>Shift Time</label>
                  <select
                    className="form-control"
                    value={seatType}
                    onChange={(e) => setSeatType(e.target.value)}
                    required
                  >
                    <option value="morning">Only Morning</option>
                    <option value="evening">Only Evening</option>
                    <option value="both">Both</option>
                  </select>
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
                  <label>Discount (₹)</label>
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
                  placeholder="e.g. UPI transfer"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'right' }}>
                <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem', float: 'left', marginTop: '0.5rem' }}>
                  Total: ₹{calculatedTotal}
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

      {/* 3. Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: 'var(--color-expired)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle /> Remove Student?
              </h3>
              <button className="modal-close" onClick={() => setDeletingStudent(null)}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Remove <strong style={{ color: '#fff' }}>{deletingStudent.name}</strong> from the active list?
              Seat <strong style={{ color: '#fff' }}>{deletingStudent.seat_number}</strong> will be freed.
              Their full record is saved in <strong style={{ color: '#fff' }}>Deleted Students</strong> and stays in the database after refresh.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingStudent(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSubmit}>
                Move to Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Student Modal */}
      {editStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: '#fff' }}>Edit Student Details</h3>
              <button className="modal-close" onClick={() => setEditStudent(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" className="form-control" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" className="form-control" value={editPhone} onChange={e => setEditPhone(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input type="text" className="form-control" value={editWhatsApp} onChange={e => setEditWhatsApp(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Seat Number</label>
                  <input type="number" className="form-control" value={editSeatNumber} onChange={e => setEditSeatNumber(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" className="form-control" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Parent / Emergency Contact</label>
                  <input type="text" className="form-control" value={editParentPhone} onChange={e => setEditParentPhone(e.target.value)} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1rem', textAlign: 'right' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditStudent(null)} style={{ marginRight: '0.75rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentList;






