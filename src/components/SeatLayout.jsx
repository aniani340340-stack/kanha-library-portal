import React, { useState } from 'react';
import { 
  Plus, 
  User, 
  Send, 
  RefreshCw, 
  Eye, 
  X,
  Calendar,
  DollarSign
} from 'lucide-react';
import StudentList from './StudentList'; // reuse modals if needed, or build custom popup

function SeatLayout({ stats, students, onAddToast, onDataChange }) {
  const [selectedSeatStudents, setSelectedSeatStudents] = useState([]);
  const [sessionFilter, setSessionFilter] = useState('all'); // all | morning | evening

  // Fixed 34 seats order (requested)
  // Top -> Bottom: row 1: 24-34, row 2: 13-23, row 3: 1-12
  const topRow = Array.from({ length: 11 }, (_, i) => (24 + i).toString()); // 24-34
  const middleRow = Array.from({ length: 11 }, (_, i) => (13 + i).toString()); // 13-23
  const bottomRow = Array.from({ length: 12 }, (_, i) => (1 + i).toString()); // 1-12

  const getSeatByNumber = (seatNum) => {
    return students.filter(
      (s) => String(s.seat_number) === String(seatNum)
    );
  };

  const urgencyClassForStudent = (student) => {
    const today = new Date();
    const expiry = new Date(student.expiry_date);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (student.status === 'Expired' || daysLeft < 0) return 'occupied-expired';
    if (daysLeft >= 0 && daysLeft <= 3) return 'occupied-warning';
    return 'occupied-active';
  };

  const getMorningEveningOccupantsForSeat = (seatNum) => {
    const seatStudents = getSeatByNumber(seatNum);

    const morning = seatStudents.find(
      (s) => s.seat_time === 'morning' || s.seat_type === 'both'
    );
    const evening = seatStudents.find(
      (s) => s.seat_time === 'evening' || s.seat_type === 'both'
    );

    const hasMorning = Boolean(morning);
    const hasEvening = Boolean(evening);

    return {
      hasMorning,
      hasEvening,
      morningStudent: morning || null,
      eveningStudent: evening || null,
      isShared: hasMorning && hasEvening
    };
  };

  const getSeatRenderState = (seatNum) => {
    const { hasMorning, hasEvening, isShared } =
      getMorningEveningOccupantsForSeat(seatNum);

    if (!hasMorning && !hasEvening) {
      return { mode: 'vacant', primaryClass: 'vacant' };
    }

    if (sessionFilter === 'morning') {
      if (!hasMorning) return { mode: 'vacant', primaryClass: 'vacant' };
      return { mode: 'occupied', primaryClass: 'occupied-morning', isShared };
    }

    if (sessionFilter === 'evening') {
      if (!hasEvening) return { mode: 'vacant', primaryClass: 'vacant' };
      return { mode: 'occupied', primaryClass: 'occupied-evening', isShared };
    }

    // all
    if (isShared) {
      // show morning color by default (orange)
      return { mode: 'occupied', primaryClass: 'occupied-morning', isShared };
    }

    if (hasMorning) return { mode: 'occupied', primaryClass: 'occupied-morning', isShared };
    return { mode: 'occupied', primaryClass: 'occupied-evening', isShared };
  };


  // WhatsApp Alert Link
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

  // Click handler for seats
  const handleSeatClick = (seatNum) => {
    const { hasMorning, hasEvening, morningStudent, eveningStudent } =
      getMorningEveningOccupantsForSeat(seatNum);

    if (!hasMorning && !hasEvening) {
      // If vacant, auto-fill and navigate to Registration
      sessionStorage.setItem('prefilled_seat_number', seatNum);
      onAddToast(
        `Opening Registration Form with Seat ${seatNum} selected`,
        'success'
      );

      const registerLink = document.querySelector(
        '.nav-link[onClick*="register"]'
      );
      if (registerLink) {
        registerLink.click();
      } else {
        onAddToast(
          `Select 'Student Register' in the sidebar. Seat ${seatNum} is ready.`,
          'info'
        );
      }
      return;
    }

    // Determine which students to show based on sessionFilter
    let toShow = [];
    if (sessionFilter === 'morning') {
      if (morningStudent) toShow = [morningStudent];
    } else if (sessionFilter === 'evening') {
      if (eveningStudent) toShow = [eveningStudent];
    } else {
      // all
      if (morningStudent) toShow.push(morningStudent);
      if (eveningStudent) {
        const already = toShow.some((s) => s.id === eveningStudent.id);
        if (!already) toShow.push(eveningStudent);
      }
    }

    setSelectedSeatStudents(toShow);
  };


  //Prefill check logic for RegistrationForm (will run inside RegistrationForm if mounted)
  // Let's modify RegistrationForm later to read 'prefilled_seat_number' from sessionStorage!
  // That makes it work seamlessly.

  return (
    <div>
      <div className="view-header">
        <h2 className="view-title">Seat Layout Map</h2>
        <p className="view-subtitle">Interactive visual matrix of physical cabins and study desks</p>
      </div>

      <section className="glass panel-card" style={{ minHeight: 'auto', marginBottom: '2.5rem' }}>
        <div className="seat-map-header">
          <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', color: '#fff' }}>
            Library Workspace Visualizer
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Session filter */}
            <div className="filter-pills" style={{ margin: 0 }}>
              <div
                className={`filter-pill ${sessionFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSessionFilter('all')}
              >
                All
              </div>
              <div
                className={`filter-pill ${sessionFilter === 'morning' ? 'active' : ''}`}
                style={
                  sessionFilter === 'morning'
                    ? { borderColor: 'rgba(255, 184, 0, 0.9)', color: '#ffb800' }
                    : undefined
                }
                onClick={() => setSessionFilter('morning')}
              >
                Only Morning
              </div>
              <div
                className={`filter-pill ${sessionFilter === 'evening' ? 'active' : ''}`}
                style={
                  sessionFilter === 'evening'
                    ? { borderColor: 'rgba(255, 255, 255, 0.35)', color: '#fff' }
                    : undefined
                }
                onClick={() => setSessionFilter('evening')}
              >
                Only Evening
              </div>
            </div>

            <div className="seat-legend">
              <div className="legend-item">
                <div className="legend-color color-vacant"></div>
                <span>Vacant</span>
              </div>
              <div className="legend-item">
                <div className="legend-color color-occupied-active" style={{ borderColor: 'rgba(255, 184, 0, 0.9)' }}></div>
                <span>Morning (Orange)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color color-occupied-expired" style={{ borderColor: 'rgba(255, 255, 255, 0.25)' }}></div>
                <span>Evening (Black)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Seat Map: fixed rows */}
        <div className="seat-grid" style={{ gridTemplateColumns: 'repeat(11, minmax(70px, 1fr))' }}>
          {/* top row (24-34) */}
          {topRow.map((seatNum) => {
            const renderState = getSeatRenderState(seatNum);
            const { morningStudent, eveningStudent, hasMorning, hasEvening, isShared } =
              getMorningEveningOccupantsForSeat(seatNum);
            const primaryStudent = sessionFilter === 'evening' ? eveningStudent : morningStudent;
            const studentToShow = sessionFilter === 'all' ? (isShared ? morningStudent : (hasMorning ? morningStudent : eveningStudent)) : primaryStudent;

            return (
              <div
                key={`top-${seatNum}`}
                className={`seat-node ${renderState.primaryClass} ${studentToShow ? urgencyClassForStudent(studentToShow) : ''}`}
                onClick={() => handleSeatClick(seatNum)}
              >
                <div>Seat {seatNum}</div>
                {studentToShow ? (
                  <div className="seat-occupant-name" title={studentToShow.name}>
                    {studentToShow.name.split(' ')[0]}
                  </div>
                ) : (
                  <Plus size={12} style={{ opacity: 0.4, marginTop: '2px' }} />
                )}
              </div>
            );
          })}

          {/* middle row (13-23) */}
          {middleRow.map((seatNum) => {
            const renderState = getSeatRenderState(seatNum);
            const { morningStudent, eveningStudent, hasMorning, hasEvening, isShared } =
              getMorningEveningOccupantsForSeat(seatNum);
            const primaryStudent = sessionFilter === 'evening' ? eveningStudent : morningStudent;
            const studentToShow = sessionFilter === 'all' ? (isShared ? morningStudent : (hasMorning ? morningStudent : eveningStudent)) : primaryStudent;

            return (
              <div
                key={`mid-${seatNum}`}
                className={`seat-node ${renderState.primaryClass} ${studentToShow ? urgencyClassForStudent(studentToShow) : ''}`}
                onClick={() => handleSeatClick(seatNum)}
              >
                <div>Seat {seatNum}</div>
                {studentToShow ? (
                  <div className="seat-occupant-name" title={studentToShow.name}>
                    {studentToShow.name.split(' ')[0]}
                  </div>
                ) : (
                  <Plus size={12} style={{ opacity: 0.4, marginTop: '2px' }} />
                )}
              </div>
            );
          })}

          {/* bottom row (1-12) */}
          {bottomRow.map((seatNum) => {
            const renderState = getSeatRenderState(seatNum);
            const { morningStudent, eveningStudent, hasMorning, hasEvening, isShared } =
              getMorningEveningOccupantsForSeat(seatNum);
            const primaryStudent = sessionFilter === 'evening' ? eveningStudent : morningStudent;
            const studentToShow = sessionFilter === 'all' ? (isShared ? morningStudent : (hasMorning ? morningStudent : eveningStudent)) : primaryStudent;

            return (
              <div
                key={`bot-${seatNum}`}
                className={`seat-node ${renderState.primaryClass} ${studentToShow ? urgencyClassForStudent(studentToShow) : ''}`}
                onClick={() => handleSeatClick(seatNum)}
              >
                <div>Seat {seatNum}</div>
                {studentToShow ? (
                  <div className="seat-occupant-name" title={studentToShow.name}>
                    {studentToShow.name.split(' ')[0]}
                  </div>
                ) : (
                  <Plus size={12} style={{ opacity: 0.4, marginTop: '2px' }} />
                )}
              </div>
            );
          })}
        </div>

      </section>

      {/* Seat Occupant Details Popup Modal */}
      {selectedSeatStudents.length > 0 && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: '#fff' }}>
                Seat {selectedSeatStudents[0].seat_number} Occupants
              </h3>
              <button className="modal-close" onClick={() => setSelectedSeatStudents([])}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {selectedSeatStudents.map((s) => (
                <div key={s.id} style={{ minWidth: '230px', flex: '1 1 230px' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    {s.photo_path ? (
                      <img
                        src={s.photo_path}
                        alt={s.name}
                        style={{ width: '70px', height: '90px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    ) : (
                      <div style={{ width: '70px', height: '90px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <User size={26} />
                      </div>
                    )}

                    <div>
                      <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.25rem', fontFamily: 'var(--font-header)' }}>
                        {s.name}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Phone: {s.phone}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`status-indicator ${s.status === 'Active' ? 'active' : 'expired'}`}>
                          {s.status}
                        </span>
                        <span className="seat-tag" style={{ margin: 0 }}>
                          {s.seat_type === 'both' ? 'Shared' : s.seat_time}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Valid Until:</div>
                    <div style={{ color: '#fff', fontWeight: '500' }}>
                      {s.expiry_date
                        ? new Date(s.expiry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>Paid Fees:</div>
                    <div style={{ color: 'var(--color-active)', fontWeight: 'bold' }}>
                      ₹{s.amount_paid ?? 0} / ₹{s.total_fees ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly-wise payment records */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, color: '#fff', fontFamily: 'var(--font-header)' }}>Monthly Payments (Seat {selectedSeatStudents[0].seat_number})</h4>
              </div>

              {(() => {
                const monthMap = new Map();
                selectedSeatStudents.forEach((stu) => {
                  (stu.payments || []).forEach((p) => {
                    if (!p.month) return;
                    if (!monthMap.has(p.month)) monthMap.set(p.month, []);
                    monthMap.get(p.month).push({ ...p, student: { id: stu.id, name: stu.name } });
                  });
                });

                const months = Array.from(monthMap.keys()).sort((a, b) => (a < b ? -1 : 1));

                if (months.length === 0) {
                  return <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No monthly payment records found.</div>;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {months.map((m) => {
                      const entries = monthMap.get(m) || [];
                      const monthTotal = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
                      return (
                        <div key={m} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ color: '#fff', fontWeight: 700 }}>{m}</div>
                            <div style={{ color: 'var(--color-active)', fontWeight: 800 }}>Month Total: ₹{monthTotal}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {entries.map((e, idx) => (
                              <div key={`${m}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <span>
                                  {e.student?.name ? `(${e.student.name}) ` : ''}
                                  ₹{e.amount} {e.paid_on ? `• ${e.paid_on}` : ''}
                                </span>
                                {e.remarks ? <span title={e.remarks}>📝</span> : <span />}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectedSeatStudents[0] && (
                <button
                  className="btn btn-whatsapp"
                  onClick={() => {
                    handleWhatsAppSend(selectedSeatStudents[0]);
                    setSelectedSeatStudents([]);
                  }}
                >
                  <Send size={14} /> Send WhatsApp Alert
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const s = selectedSeatStudents[0];
                  setSelectedSeatStudents([]);
                  const studentsLink = document.querySelector('.nav-link[onClick*="students"]');
                  if (studentsLink) {
                    studentsLink.click();
                    if (s?.name) sessionStorage.setItem('search_student_query', s.name);
                  }
                }}
              >
                Manage Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SeatLayout;
