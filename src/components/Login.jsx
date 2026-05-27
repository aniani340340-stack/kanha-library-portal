import React, { useState } from 'react';
import { BookOpen, Lock, Mail, LogIn } from 'lucide-react';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.token, data.email);
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass">
        <div className="login-brand">
          <BookOpen size={36} />
          <h1>
            KANHA <span className="logo-highlight">STUDY</span>
          </h1>
          <p>Admin Portal — sign in to manage your library</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="adminEmail">
              <Mail size={16} /> Admin Email
            </label>
            <input
              id="adminEmail"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@yourlibrary.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="adminPassword">
              <Lock size={16} /> Password
            </label>
            <input
              id="adminPassword"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={isSubmitting}
          >
            <LogIn size={18} />
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-footer">
          Only authorized library admins can access student records and seat management.
        </p>
      </div>
    </div>
  );
}

export default Login;
