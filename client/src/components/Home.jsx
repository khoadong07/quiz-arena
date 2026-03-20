import { useNavigate } from 'react-router-dom';
import { Gamepad2, Shield } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="screen-center">
      <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        {/* logo */}
        <div style={{textAlign: 'center'}}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(99,102,241,0.4)'
          }}>
            <Gamepad2 size={36} color="white" />
          </div>
          <h1 className="app-title">Quiz Arena</h1>
          <p className="text-muted" style={{marginTop: '0.5rem', fontSize: '0.95rem'}}>
            Interactive quiz battles, real-time fun.
          </p>
        </div>

        <div className="divider" />

        <div className="form-stack">
          <button className="btn btn-primary" onClick={() => navigate('/join')}>
            <Gamepad2 size={20} />
            Join Game
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/create')}>
            <Shield size={20} />
            Gamemaster
          </button>
        </div>
      </div>
    </div>
  );
}
