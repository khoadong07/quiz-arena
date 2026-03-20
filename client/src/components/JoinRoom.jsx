import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function JoinRoom() {
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If QR code was scanned, ?otp=XXXXXX is in URL → skip to setup directly
  useEffect(() => {
    const otpFromQR = searchParams.get('otp');
    if (otpFromQR && otpFromQR.length === 6) {
      navigate('/setup', { state: { otp: otpFromQR }, replace: true });
    }
  }, [searchParams, navigate]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (otp.trim().length === 6) {
      navigate('/setup', { state: { otp } });
    } else {
      alert('Vui lòng nhập CODE 6 chữ số hợp lệ!');
    }
  };

  return (
    <div className="screen-center">
      <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1.75rem'}}>
        <button
          onClick={() => navigate('/')}
          style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem', padding: 0}}
        >
          <ArrowLeft size={18} /> Quay lại
        </button>

        <div>
          <h2 className="section-title">Vào Phòng</h2>
          <p className="text-muted" style={{fontSize: '0.9rem'}}>Nhập CODE 6 chữ số từ Gamemaster.</p>
        </div>

        <form onSubmit={handleJoin} className="form-stack">
          <input
            className="input-field"
            placeholder="● ● ● ● ● ●"
            value={otp}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            style={{
              textAlign: 'center',
              fontSize: '2rem',
              fontWeight: '800',
              letterSpacing: '0.3em',
              padding: '1rem'
            }}
          />
          <button className="btn btn-primary" type="submit">
            <ArrowRight size={20} /> Tiếp tục
          </button>
        </form>
      </div>
    </div>
  );
}
