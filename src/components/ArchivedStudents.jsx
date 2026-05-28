import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/auth';
import {
  Archive,
  Search,
  RotateCcw,
  Trash2,
  Eye,
  X,
  AlertTriangle
} from 'lucide-react';

function ArchivedStudents({ onAddToast, onDataChange }) {
  const [archived, setArchived] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [restoringStudent, setRestoringStudent] = useState(null);
  const [restoreSeat, setRestoreSeat] = useState('');
  const [permanentDeleteStudent, setPermanentDeleteStudent] = useState(null);

  const loadArchived = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/students/archived');
      if (!res.ok) throw new Error('Failed to load archive');
      const data = await res.json();
      setArchived(data);
    } catch {
      onAddToast('Could not load deleted students archive.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArchived();
  }, []);

  const filtered = archived.filter((s) => {
    const q = searchTerm.toLowerCase();
    const seat = (s.original_seat_number || s.seat_number || '').toString();
    return (
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(searchTerm) ||
      seat.includes(searchTerm)
    );
  });

  const handleRestore = async (e) => {
    e.preventDefault();
    if (!restoreSeat.trim()) {
      onAddToast('Enter a seat number to restore this student.', 'error');
      return;
    }

    try {
      const res = await apiFetch(`/api/students/${restoringStudent.id}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_number: restoreSeat.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');

      onAddToast(`${restoringStudent.name} restored to Seat ${restoreSeat}!`, 'success');
      setRestoringStudent(null);
      setRestoreSeat('');
      loadArchived();
      if (onDataChange) onDataChange();
    } catch (err) {
      onAddToast(err.message || 'Failed to restore student.', 'error');
    }
  };

  const handlePermanentDelete = async () => {
    try {
      const res = await apiFetch(
        `/api/students/${permanentDeleteStudent.id}/permanent`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Permanent delete failed');

      onAddToast(`${permanentDeleteStudent.name} permanently removed.`, 'success');
      setPermanentDeleteStudent(null);
      loadArchived();
    } catch {
      onAddToast('Failed to permanently delete.', 'error');
    }
  };

  const displaySeat = (s) => s.original_seat_number || s.seat_number;

  return (
    <div className="glass panel-card archive-page">
      <div className="panel-header">
        <h2 className="panel-title">
          <Archive /> Deleted Students Archive
        </h2>
        <p className="archive-subtitle">
          Removed students are saved here permanently. Data stays in the database even after refresh or redeploy (on hosted disk).
        </p>
      </div>

      <div className="archive-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, phone, or seat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="archive-count">
          {filtered.length} saved record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', marginTop: '2rem', textAlign: 'center' }}>Loading archive…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: '2rem', textAlign: 'center' }}>
          No deleted students yet. When you remove someone from the directory, they appear here.
        </p>
      ) : (
        <div className="table-container archive-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Seat (was)</th>
                <th>Expiry</th>
                <th>Deleted on</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td className="archive-name-cell">{student.name}</td>
                  <td>{student.phone}</td>
                  <td>
                    <span className="seat-tag">Seat {displaySeat(student)}</span>
                  </td>
                  <td>{student.expiry_date}</td>
                  <td className="archive-date-cell">
                    {student.archived_at
                      ? new Date(student.archived_at).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="icon-btn"
                        title="View details"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Restore to active"
                        onClick={() => {
                          setRestoringStudent(student);
                          setRestoreSeat(
                            student.original_seat_number?.replace(/^Archived-/i, '') ||
                              ''
                          );
                        }}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Delete forever"
                        onClick={() => setPermanentDeleteStudent(student)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{selectedStudent.name}</h3>
              <button className="modal-close" onClick={() => setSelectedStudent(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="detail-grid">
              <div className="detail-field">
                <h5>Phone</h5>
                <p>{selectedStudent.phone}</p>
              </div>
              <div className="detail-field">
                <h5>WhatsApp</h5>
                <p>{selectedStudent.whatsapp}</p>
              </div>
              <div className="detail-field">
                <h5>Seat (was)</h5>
                <p>{displaySeat(selectedStudent)}</p>
              </div>
              <div className="detail-field">
                <h5>Total fees</h5>
                <p>₹{selectedStudent.total_fees}</p>
              </div>
              <div className="detail-field">
                <h5>Expiry</h5>
                <p>{selectedStudent.expiry_date}</p>
              </div>
              <div className="detail-field">
                <h5>Remarks</h5>
                <p>{selectedStudent.remarks || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoringStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Restore {restoringStudent.name}</h3>
              <button className="modal-close" onClick={() => setRestoringStudent(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRestore}>
              <div className="form-group">
                <label>Assign seat number</label>
                <input
                  className="form-control"
                  value={restoreSeat}
                  onChange={(e) => setRestoreSeat(e.target.value)}
                  placeholder="e.g. 12"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestoringStudent(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Restore student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permanentDeleteStudent && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--color-expired)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle /> Delete forever?
              </h3>
              <button className="modal-close" onClick={() => setPermanentDeleteStudent(null)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This removes <strong style={{ color: '#fff' }}>{permanentDeleteStudent.name}</strong> from the archive permanently. Cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setPermanentDeleteStudent(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handlePermanentDelete}>
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchivedStudents;
