import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Play, ArrowLeft, CheckCircle2, Users } from 'lucide-react';
import { socket } from '../socket';
import { imageCache } from '../utils/imageCache';

export default function CreateRoom() {
  const [maxPlayers, setMaxPlayers] = useState(100);
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (Array.isArray(json) && json.length > 0) {
          setQuestions(json);
          // Preload images immediately when JSON is loaded
          const imageUrls = json.map(q => q.image).filter(Boolean);
          imageCache.preload(imageUrls);
        } else {
          alert('File JSON không hợp lệ. Đảm bảo file là một mảng các câu hỏi.');
        }
      } catch {
        alert('Lỗi đọc file JSON!');
      }
    };
    reader.readAsText(file);
  };

  const handleCreate = () => {
    if (!questions) { alert('Vui lòng tải lên danh sách câu hỏi!'); return; }
    setLoading(true);
    socket.connect();
    socket.emit('create-room', { maxPlayers: Number(maxPlayers), questions }, (res) => {
      setLoading(false);
      if (res.success) {
        localStorage.setItem(`khoot_admin_${res.otp}`, res.adminToken);
        navigate(`/admin/room/${res.otp}`);
      } else {
        alert('Có lỗi xảy ra khi tạo phòng.');
      }
    });
  };

  return (
    <div className="screen-center">
      <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <button
          onClick={() => navigate('/')}
          style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem', padding: 0}}
        >
          <ArrowLeft size={18} /> Quay lại
        </button>

        <div>
          <h2 className="section-title">Tạo Phòng Mới</h2>
          <p className="text-muted" style={{fontSize: '0.9rem'}}>Cấu hình trước khi bắt đầu trò chơi.</p>
        </div>

        {/* Max players */}
        <div>
          <label style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem'}}>
            <Users size={16} /> Số người chơi tối đa
          </label>
          <input
            type="number"
            className="input-field"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            min="1" max="1000"
          />
        </div>

        {/* File upload */}
        <div>
          <input type="file" accept=".json" style={{display: 'none'}} ref={fileInputRef} onChange={handleFileUpload} />
          <button
            className={`btn ${questions ? 'btn-ghost' : 'btn-ghost'}`}
            style={{borderStyle: 'dashed', border: `1.5px dashed ${questions ? 'var(--success)' : 'rgba(255,255,255,0.2)'}`, color: questions ? 'var(--success)' : 'var(--text-muted)'}}
            onClick={() => fileInputRef.current.click()}
          >
            {questions ? <CheckCircle2 size={20} /> : <Upload size={20} />}
            {questions ? `${questions.length} câu hỏi đã tải` : 'Tải lên File JSON câu hỏi'}
          </button>
        </div>

        <button className="btn btn-secondary" onClick={handleCreate} disabled={!questions || loading}>
          <Play size={20} />
          {loading ? 'Đang tạo...' : 'Tạo Phòng'}
        </button>
      </div>
    </div>
  );
}
