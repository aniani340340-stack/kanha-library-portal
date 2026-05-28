import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Grid,
  Archive,
  Settings as SettingsIcon,
  BookOpen,
  WifiOff,
  Bell,
  LogOut
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import RegistrationForm from './components/RegistrationForm';
import StudentList from './components/StudentList';
import SeatLayout from './components/SeatLayout';
import ArchivedStudents from './components/ArchivedStudents';
import Login from './components/Login';
import { apiFetch, getToken, setToken, clearToken } from './utils/auth';

// Inline simple Settings component to reduce file count and keep it centralized
function Settings({ stats, onAddToast, onDataChange }) {
  const [totalSeats, setTotalSeats] = useState(
    () => localStorage.getItem('kanha_library_total_seats') || '60'
  );
  const [notifInfo, setNotifInfo] = useState(null);

  useEffect(() => {
    apiFetch('/api/notifications')
      .then((r) => r.json())
      .then(setNotifInfo)
      .catch(() => {});
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (isNaN(totalSeats) || Number(totalSeats) <= 0) {
      onAddToast('Please enter a valid seat count (greater than 0).', 'error');
      return;
    }
    localStorage.setItem('kanha_library_total_seats', totalSeats);
    onAddToast('Settings saved successfully! Layout updated.', 'success');
    if (onDataChange) onDataChange();
  };

  return (
    <div className="glass panel-card" style={{ maxWidth: '600px', minHeight: 'auto' }}>
      <h3 className="panel-title" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <SettingsIcon /> Library Setup Settings
      </h3>
      <form onSubmit={handleSave} style={{ marginTop: '1.5rem' }}>
        <div className="form-group">
          <label htmlFor="totalSeats">Total Library Seats / Cabins</label>
          <input
            type="number"
            id="totalSeats"
            className="form-control"
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
            placeholder="e.g. 60"
            min="1"
            max="300"
            required
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Sets the number of physical cabins/desks available in the Seat Map grid.
          </p>
        </div>
        
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary">
            Save Settings
          </button>
        </div>
      </form>

      <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ marginBottom: '0.75rem', fontFamily: 'var(--font-header)', color: '#fff' }}>Database & System Info</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>Database Mode:</div>
          <div style={{ color: 'var(--color-active)', fontWeight: 'bold' }}>SQLite 3 (Production Cloud Host Ready)</div>
          <div>Storage Path:</div>
          <code>./data/db.sqlite</code>
          <div>Photo Directory:</div>
          <code>./data/uploads/</code>
          <div>Seat Occupancy:</div>
          <div>{stats.occupiedSeats ? stats.occupiedSeats.length : 0} Seats Occupied</div>
          <div>Deleted Students Saved:</div>
          <div>{stats.archived ?? 0} in archive</div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ marginBottom: '0.75rem', fontFamily: 'var(--font-header)', color: '#fff' }}>
          Telegram admin alerts
        </h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          When a student&apos;s subscription ends or is close to ending, an admin alert can be sent to your Telegram chat.
          {/* WhatsApp section disabled to avoid build issues on Vite/JSX.
              Enable later if you want CALLMEBOT_API_KEY integration. */}
        </p>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>Status:{' '}
            <span style={{ color: notifInfo?.telegramConfigured ? 'var(--color-active)' : 'var(--color-warning)' }}>
              {notifInfo?.telegramConfigured ? 'Connected' : 'Not configured - add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on host'}
            </span>
          </div>
          {false && (
          <div>Status:{' '}
            <span style={{ color: notifInfo?.whatsappConfigured ? 'var(--color-active)' : 'var(--color-warning)' }}>
              {notifInfo?.whatsappConfigured ? 'Connected' : 'Not configured — add CALLMEBOT_API_KEY on host'}
            </span>
          </div>
          )}
          {notifInfo?.notifications?.length > 0 && (
            <p style={{ marginTop: '0.5rem' }}>
              Last alert: {notifInfo.notifications[0].student_name || '—'} —{' '}
              {new Date(notifInfo.notifications[0].sent_at).toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: '1rem' }}
          onClick={async () => {
            const r = await apiFetch('/api/notifications/check-expiry', { method: 'POST' });
            const d = await r.json();
            onAddToast(d.message || 'Check started', 'success');
          }}
        >
          Run expiry check now
        </button>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0,
    revenue: 0,
    archived: 0,
    occupiedSeats: []
  });
  const [toasts, setToasts] = useState([]);
  const [isBackendDown, setIsBackendDown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleLogout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
    setAdminEmail('');
    setStudents([]);
  }, []);

  const verifySession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsCheckingAuth(false);
      return false;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
        clearToken();
        setIsCheckingAuth(false);
        return false;
      }
      const data = await res.json();
      setAdminEmail(data.email);
      setIsAuthenticated(true);
      setIsCheckingAuth(false);
      return true;
    } catch {
      clearToken();
      setIsCheckingAuth(false);
      return false;
    }
  }, []);

  const handleLoginSuccess = (token, email) => {
    setToken(token);
    setAdminEmail(email);
    setIsAuthenticated(true);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const statsRes = await apiFetch('/api/stats');
      if (!statsRes.ok) throw new Error('API server returned error');
      const statsData = await statsRes.json();
      setStats(statsData);

      const studentsRes = await apiFetch('/api/students');
      if (!studentsRes.ok) throw new Error('API server returned error');
      const studentsData = await studentsRes.json();
      setStudents(studentsData);
      
      setIsBackendDown(false);
    } catch (error) {
      console.error('Error fetching data from backend:', error);
      setIsBackendDown(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  useEffect(() => {
    const onAuthExpired = () => {
      handleLogout();
      addToast('Session expired. Please sign in again.', 'error');
    };
    window.addEventListener('kanha-auth-expired', onAuthExpired);
    return () => window.removeEventListener('kanha-auth-expired', onAuthExpired);
  }, [handleLogout]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  if (isCheckingAuth) {
    return (
      <div className="login-page">
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo-container">
          <BookOpen size={28} />
          <span className="logo-text">
            KANHA <span className="logo-highlight">STUDY</span>
          </span>
        </div>

        <nav className="nav-links">
          <div 
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard /> Dashboard
          </div>
          <div 
            className={`nav-link ${currentView === 'register' ? 'active' : ''}`}
            onClick={() => setCurrentView('register')}
          >
            <UserPlus /> Student Register
          </div>
          <div 
            className={`nav-link ${currentView === 'students' ? 'active' : ''}`}
            onClick={() => setCurrentView('students')}
          >
            <Users /> Student Directory
          </div>
          <div 
            className={`nav-link ${currentView === 'seats' ? 'active' : ''}`}
            onClick={() => setCurrentView('seats')}
          >
            <Grid /> Seat Layout
          </div>
          <div 
            className={`nav-link ${currentView === 'archive' ? 'active' : ''}`}
            onClick={() => setCurrentView('archive')}
          >
            <Archive /> Deleted Students
          </div>
          <div 
            className={`nav-link ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <SettingsIcon /> Settings
          </div>
        </nav>

        <div className="sidebar-admin">
          <div className="sidebar-admin-email">{adminEmail}</div>
          <button type="button" className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.75rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isBackendDown ? 'var(--color-expired)' : 'var(--color-active)' }}></div>
          {isBackendDown ? 'Backend Offline' : 'Backend Connected'}
        </div>
      </aside>

      <main className="main-content">
        {isBackendDown ? (
          <div className="glass panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
            <WifiOff size={48} color="var(--color-expired)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontFamily: 'var(--font-header)', marginBottom: '0.5rem', color: '#fff' }}>Connection to server lost</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px' }}>
              The backend server appears to be offline. Run <code>npm run dev</code> locally, or check your online hosting service.
            </p>
            <button className="btn btn-primary" onClick={fetchData}>
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard 
                stats={stats} 
                onNavigate={setCurrentView} 
                onAddToast={addToast} 
                onDataChange={fetchData} 
              />
            )}
            {currentView === 'register' && (
              <RegistrationForm 
                onAddToast={addToast} 
                onDataChange={fetchData} 
                onNavigate={setCurrentView} 
              />
            )}
            {currentView === 'students' && (
              <StudentList 
                students={students} 
                onAddToast={addToast} 
                onDataChange={fetchData} 
              />
            )}
            {currentView === 'seats' && (
              <SeatLayout 
                stats={stats} 
                students={students} 
                onAddToast={addToast} 
                onDataChange={fetchData} 
              />
            )}
            {currentView === 'archive' && (
              <ArchivedStudents
                onAddToast={addToast}
                onDataChange={fetchData}
              />
            )}
            {currentView === 'settings' && (
              <Settings 
                stats={stats} 
                onAddToast={addToast} 
                onDataChange={fetchData} 
              />
            )}
          </>
        )}
      </main>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <Bell size={18} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
