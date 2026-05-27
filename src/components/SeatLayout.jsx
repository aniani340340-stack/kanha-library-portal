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
  const [selectedSeatStudent, setSelectedSeatStudent] = useState(null);
  
  // Read total seat capacity (configured in Settings, defaults to 60)
  const totalSeats = Number(localStorage.getItem('kanha_library_total_seats')) || 60;
  
  // Create an array representing seats 1 to totalSeats
  const seatsArray = Array.from({ length: totalSeats }, (_, i) => (i + 1).toString());

  // Helper: Find occupant and status of a seat
  const getSeatInfo = (seatNum) => {
    // Search active/expired students
    const student = students.find(s => s.seat_number.toString() === seatNum);
    if (!student) return { status: 'vacant', student: null };

    // Calculate urgency status
    const today = new Date();
    const expiry = new Date(student.expiry_date);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (student.status === 'Expired' || daysLeft < 0) {
      return { status: 'occupied-expired', student };
    } else if (daysLeft >= 0 && daysLeft <= 3) {
      return { status: 'occupied-warning', student };
    } else {
      return { status: 'occupied-active', student };
    }
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
    const { status, student } = getSeatInfo(seatNum);
    
    if (status === 'vacant') {
      // If vacant, auto-fill and navigate to Registration
      // We can use a trick: save seat to session storage and click Student Register in sidebar
      sessionStorage.setItem('prefilled_seat_number', seatNum);
      onAddToast(`Opening Registration Form with Seat ${seatNum} selected`, 'success');
      
      // Programmatically click Register link by changing active view
      // Since App.jsx manages currentView, we can trigger navigation by simulating a click
      // or we can reload the layout. But wait, how do we notify App?
      // Since we don't have a direct router, we can simulate a click on the sidebar Register link.
      const registerLink = document.querySelector('.nav-link[onClick*="register"]');
      if (registerLink) {
        registerLink.click();
      } else {
        // Fallback: tell user to click Student Register
        onAddToast(`Select 'Student Register' in the sidebar. Seat ${seatNum} is ready.`, 'info');
      }
    } else {
      // Show occupant quick detail card
      setSelectedSeatStudent(student);
    }
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
          <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', color: '#fff' }}>Library Workspace Visualizer</h3>
          
          <div className="seat-legend">
            <div className="legend-item">
              <div className="legend-color color-vacant"></div>
              <span>Vacant</span>
            </div>
            <div className="legend-item">
              <div className="legend-color color-occupied-active"></div>
              <span>Occupied (Active)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color color-occupied-warning"></div>
              <span>Expiring (3 Days)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color color-occupied-expired"></div>
              <span>Expired</span>
            </div>
          </div>
        </div>

        {/* Seat Map visual grid matrix */}
        <div className="seat-grid">
          {seatsArray.map(seatNum => {
            const { status, student } = getSeatInfo(seatNum);
            
            return (
              <div 
                key={seatNum} 
                className={`seat-node ${status}`}
                onClick={() => handleSeatClick(seatNum)}
              >
                <div>Seat {seatNum}</div>
                {student && (
                  <div className="seat-occupant-name" title={student.name}>
                    {student.name.split(' ')[0]}
                  </div>
                )}
                {!student && (
                  <Plus size={12} style={{ opacity: 0.4, marginTop: '2px' }} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Seat Occupant Details Popup Modal */}
      {selectedSeatStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-header)', color: '#fff' }}>Seat {selectedSeatStudent.seat_number} Occupant</h3>
              <button className="modal-close" onClick={() => setSelectedSeatStudent(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              {selectedSeatStudent.photo_path ? (
                <img 
                  src={selectedSeatStudent.photo_path} 
                  alt={selectedSeatStudent.name} 
                  style={{ width: '90px', height: '110px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: '90px', height: '110px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <User size={32} />
                </div>
              )}

              <div>
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.25rem', fontFamily: 'var(--font-header)' }}>{selectedSeatStudent.name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Phone: {selectedSeatStudent.phone}</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`status-indicator ${
                    selectedSeatStudent.status === 'Active' ? 'active' : 'expired'
                  }`}>
                    {selectedSeatStudent.status}
                  </span>
                  <span className="seat-tag" style={{ margin: 0 }}>Cabin {selectedSeatStudent.seat_number}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>Valid Until:</div>
                <div style={{ color: '#fff', fontWeight: '500' }}>
                  {new Date(selectedSeatStudent.expiry_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Paid Fees:</div>
                <div style={{ color: 'var(--color-active)', fontWeight: 'bold' }}>
                  ₹{selectedSeatStudent.amount_paid} / ₹{selectedSeatStudent.total_fees}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                className="btn btn-whatsapp" 
                onClick={() => {
                  handleWhatsAppSend(selectedSeatStudent);
                  setSelectedSeatStudent(null);
                }}
              >
                <Send size={14} /> Send WhatsApp Alert
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  // Direct to directory and search their name
                  setSelectedSeatStudent(null);
                  const studentsLink = document.querySelector('.nav-link[onClick*="students"]');
                  if (studentsLink) {
                    studentsLink.click();
                    // Put their name in clipboard or sessionStorage to pre-fill search
                    sessionStorage.setItem('search_student_query', selectedSeatStudent.name);
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
