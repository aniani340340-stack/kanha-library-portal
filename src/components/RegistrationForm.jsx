import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Image as ImageIcon, CheckCircle, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../utils/auth';

function RegistrationForm({ onAddToast, onDataChange, onNavigate }) {
  // Form input states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [duration, setDuration] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rate, setRate] = useState('1000'); // default monthly rate
  const [discount, setDiscount] = useState('0');
  const [feeStatus, setFeeStatus] = useState('Paid');
  const [amountPaid, setAmountPaid] = useState('1000');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill seat number if coming from Seat Layout Click
  useEffect(() => {
    const prefilledSeat = sessionStorage.getItem('prefilled_seat_number');
    if (prefilledSeat) {
      setSeatNumber(prefilledSeat);
      sessionStorage.removeItem('prefilled_seat_number');
    }
  }, []);

  // Photo Source option: 'webcam' or 'upload'
  const [photoSource, setPhotoSource] = useState('webcam');
  const [capturedPhoto, setCapturedPhoto] = useState(null); // base64 string
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // Webcam references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const streamRef = useRef(null);

  // Calculate dynamic fees
  const calculatedTotal = (Number(rate) * Number(duration)) - Number(discount);

  // Synchronize amountPaid based on feeStatus and rate
  useEffect(() => {
    if (feeStatus === 'Paid') {
      setAmountPaid(calculatedTotal.toString());
    } else if (feeStatus === 'Unpaid') {
      setAmountPaid('0');
    }
  }, [feeStatus, rate, duration, discount]);

  // Webcam Controls
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setCameraError('Could not access camera. Please check permissions or upload a photo.');
      setPhotoSource('upload');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Configure canvas matching video dimensions
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Draw frame to canvas (horizontal flip for normal view)
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.setTransform(1, 0, 0, 1, 0, 0); // reset scale
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  useEffect(() => {
    if (photoSource === 'webcam' && !capturedPhoto) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [photoSource, capturedPhoto]);

  // File Upload Controls
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Form handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isNaN(seatNumber) || Number(seatNumber) <= 0) {
      onAddToast('Please enter a valid seat number.', 'error');
      return;
    }

    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('whatsapp', whatsapp);
    formData.append('parent_phone', parentPhone);
    formData.append('seat_number', seatNumber.trim());
    formData.append('duration', duration);
    formData.append('start_date', startDate);
    formData.append('rate', rate);
    formData.append('discount', discount);
    formData.append('total_fees', calculatedTotal);
    formData.append('fee_status', feeStatus);
    formData.append('amount_paid', amountPaid);
    formData.append('remarks', remarks);

    // Attach student photo
    if (photoSource === 'upload' && uploadedFile) {
      formData.append('photo', uploadedFile);
    } else if (photoSource === 'webcam' && capturedPhoto && !capturedPhoto.startsWith('data:image')) {
      // file uploaded but not webcam
    } else if (capturedPhoto) {
      formData.append('photo_base64', capturedPhoto);
    }

    try {
      const response = await apiFetch('/api/students', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to register student');
      }

      onAddToast(`Registered ${name} successfully at Seat ${seatNumber}!`, 'success');
      onDataChange(); // refresh dashboard stats
      onNavigate('dashboard'); // go back to dashboard
    } catch (err) {
      console.error(err);
      onAddToast(err.message || 'Error occurred during registration.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')} style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="view-title">Register New Student</h2>
          <p className="view-subtitle">Enter student information, select seat, and capture photo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass panel-card">
        <div className="form-grid">
          
          {/* Left Column: Personal and Subscription Info */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', marginBottom: '1.25rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Personal Details
            </h3>

            <div className="form-group">
              <label htmlFor="studentName">Student Name *</label>
              <input
                type="text"
                id="studentName"
                className="form-control"
                placeholder="e.g. Abhishek Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
              <div className="form-group">
                <label htmlFor="phone">Contact Number *</label>
                <input
                  type="tel"
                  id="phone"
                  className="form-control"
                  placeholder="10-digit mobile"
                  pattern="[0-9]{10}"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!whatsapp) setWhatsapp(e.target.value); // autofill WhatsApp
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="whatsapp">WhatsApp Number *</label>
                <input
                  type="tel"
                  id="whatsapp"
                  className="form-control"
                  placeholder="WhatsApp number"
                  pattern="[0-9]{10}"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
              <div className="form-group">
                <label htmlFor="parentPhone">Emergency Contact</label>
                <input
                  type="tel"
                  id="parentPhone"
                  className="form-control"
                  placeholder="Guardian mobile"
                  pattern="[0-9]{10}"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="seatNo">Allocated Seat Number *</label>
                <input
                  type="number"
                  id="seatNo"
                  className="form-control"
                  placeholder="e.g. 15"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', marginTop: '2rem', marginBottom: '1.25rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Subscription Details
            </h3>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
              <div className="form-group">
                <label htmlFor="startDate">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration">Duration (Months)</label>
                <select
                  id="duration"
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
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
              <div className="form-group">
                <label htmlFor="rate">Monthly Rate (₹)</label>
                <input
                  type="number"
                  id="rate"
                  className="form-control"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="discount">Discount (₹)</label>
                <input
                  type="number"
                  id="discount"
                  className="form-control"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
              <div className="form-group">
                <label htmlFor="feeStatus">Payment Status</label>
                <select
                  id="feeStatus"
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
                  <label htmlFor="amountPaid">Amount Paid (₹)</label>
                  <input
                    type="number"
                    id="amountPaid"
                    className="form-control"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    min="0"
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="remarks">Remarks</label>
              <input
                type="text"
                id="remarks"
                className="form-control"
                placeholder="Payment method, batch timings, etc."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Photo Capture and Summary */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '1.1rem', marginBottom: '1.25rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Student Photo Click
            </h3>

            {/* Photo Source Selector */}
            <div className="filter-pills" style={{ marginBottom: '1rem' }}>
              <div 
                className={`filter-pill ${photoSource === 'webcam' ? 'active pill-active' : ''}`}
                onClick={() => {
                  setPhotoSource('webcam');
                  setCapturedPhoto(null);
                }}
              >
                <Camera size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Webcam Capture
              </div>
              <div 
                className={`filter-pill ${photoSource === 'upload' ? 'active pill-active' : ''}`}
                onClick={() => {
                  setPhotoSource('upload');
                  setCapturedPhoto(null);
                }}
              >
                <Upload size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> File Upload
              </div>
            </div>

            {/* Webcam Window */}
            {photoSource === 'webcam' && (
              <div className="webcam-container">
                {cameraError ? (
                  <p style={{ color: 'var(--color-expired)', fontSize: '0.85rem', textAlign: 'center' }}>{cameraError}</p>
                ) : !capturedPhoto ? (
                  <>
                    <video ref={videoRef} autoPlay className="webcam-preview"></video>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-primary" onClick={capturePhoto} style={{ padding: '0.5rem 1rem' }}>
                        <Camera size={16} /> Click Photo
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={stopCamera} style={{ padding: '0.5rem 1rem' }}>
                        Turn Off
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <img src={capturedPhoto} alt="Captured Student" className="captured-image" />
                    <div style={{ marginTop: '1rem' }}>
                      <button type="button" className="btn btn-secondary" onClick={retakePhoto} style={{ padding: '0.5rem 1rem' }}>
                        <RefreshCw size={16} /> Retake
                      </button>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
              </div>
            )}

            {/* File Upload Window */}
            {photoSource === 'upload' && (
              <div className="webcam-container">
                {!capturedPhoto ? (
                  <div style={{ textAlign: 'center' }}>
                    <ImageIcon size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Upload student portrait (JPG or PNG)</p>
                    <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                      <Upload size={16} /> Choose File
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                ) : (
                  <>
                    <img src={capturedPhoto} alt="Uploaded Student" className="captured-image" />
                    <div style={{ marginTop: '1rem' }}>
                      <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.5rem 1rem' }}>
                        <RefreshCw size={16} /> Change File
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Fee summary block */}
            <div className="glass" style={{ marginTop: 'auto', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', marginBottom: '0.75rem', color: '#fff' }}>Registration Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Calculation:</span>
                  <span>₹{rate} × {duration} Month(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Discount:</span>
                  <span style={{ color: 'var(--color-expired)' }}>- ₹{discount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
                  <span>Total Fees:</span>
                  <span>₹{calculatedTotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: feeStatus === 'Paid' ? 'var(--color-active)' : (feeStatus === 'Unpaid' ? 'var(--color-expired)' : 'var(--color-warning)') }}>
                  <span>Amount to Pay Now:</span>
                  <span>₹{amountPaid}</span>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%', padding: '1rem' }} disabled={isSubmitting}>
              <CheckCircle size={18} /> {isSubmitting ? 'Registering Student...' : 'Register and Assign Seat'}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}

export default RegistrationForm;
