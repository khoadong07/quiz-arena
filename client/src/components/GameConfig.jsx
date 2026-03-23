import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Save, Plus, Trash2, Eye, Download, Upload, Image as ImageIcon } from 'lucide-react';

export default function GameConfig() {
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([
    { question: '', choices: ['', '', '', ''], correct: 0, image: '' }
  ]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '210317') {
      setAuthorized(true);
      setError('');
    } else {
      setError('Mật khẩu không đúng!');
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', choices: ['', '', '', ''], correct: 0, image: '' }]);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateChoice = (qIndex, cIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].choices[cIndex] = value;
    setQuestions(newQuestions);
  };

  const handleFileUpload = async (index, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3001/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        updateQuestion(index, 'image', data.url);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Không thể tải ảnh lên server!');
    }
  };

  const handleSave = () => {
    const dataStr = JSON.stringify(questions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().getTime();
    link.href = url;
    link.download = `game-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!authorized) {
    return (
      <div className="screen-center">
        <div className="card" style={{ maxWidth: '400px', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(99,102,241,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Lock size={32} style={{ color: 'var(--primary)' }} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900 }}>CẤU HÌNH HỆ THỐNG</h1>
            <p className="text-muted">Nhập mật khẩu để tiếp tục</p>
          </div>
          <form onSubmit={handleLogin} className="form-stack">
            <input 
              type="password" 
              className="input-field" 
              placeholder="Mật khẩu" 
              autoFocus 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600 }}>{error}</p>}
            <button className="btn btn-primary" type="submit">XÁC MINH</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-screen" style={{ backgroundColor: '#0a0e1e', backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 50%)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '2rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Quản lý câu hỏi</h1>
            <p className="text-muted">Tạo mới và chỉnh sửa dữ liệu trò chơi của bạn</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleSave} style={{ width: 'auto', padding: '0 1.5rem' }}>
              <Save size={20} /> LƯU FILE JSON
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="card" style={{ maxWidth: 'none', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, background: 'var(--primary)', color: 'white', padding: '0.25rem 1rem', borderRadius: '8px' }}>
                  Câu {qIndex + 1}
                </span>
                <button 
                  onClick={() => removeQuestion(qIndex)} 
                  disabled={questions.length === 1}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}
                >
                  <Trash2 size={24} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                <div className="form-stack">
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>CÂU HỎI</label>
                  <textarea 
                    className="input-field" 
                    placeholder="Nhập nội dung câu hỏi..." 
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    value={q.question}
                    onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                  />

                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem' }}>ĐÁP ÁN (Chọn dấu tích cho câu đúng)</label>
                  <div className="form-stack">
                    {q.choices.map((c, cIndex) => (
                      <div key={cIndex} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div 
                          onClick={() => updateQuestion(qIndex, 'correct', cIndex)}
                          style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: q.correct === cIndex ? 'var(--success)' : 'rgba(255,255,255,0.05)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            border: '1px solid ' + (q.correct === cIndex ? 'transparent' : 'var(--border)')
                          }}
                        >
                          <Plus size={20} style={{ color: 'white', transform: q.correct === cIndex ? 'rotate(135deg)' : 'none', transition: '0.2s' }} />
                        </div>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder={`Đáp án ${String.fromCharCode(65 + cIndex)}`}
                          value={c}
                          onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-stack" style={{ textAlign: 'center' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>HÌNH ẢNH MINH HỌA</label>
                  <div style={{ 
                    marginTop: '0.5rem', 
                    height: '240px', 
                    borderRadius: '16px', 
                    border: '2px dashed var(--border)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {q.image ? (
                      <>
                        <img src={q.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                             <label className="btn btn-primary" style={{ height: '40px', minHeight: '40px', width: '40px', padding: 0, borderRadius: '10px' }}>
                                <Upload size={18} />
                                <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(qIndex, e.target.files[0])} />
                             </label>
                             <button onClick={() => updateQuestion(qIndex, 'image', '')} className="btn btn-danger" style={{ height: '40px', minHeight: '40px', width: '40px', padding: 0, borderRadius: '10px' }}>
                                <Trash2 size={18} />
                             </button>
                        </div>
                      </>
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                         <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                         <span style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.5 }}>Nhấn để tải ảnh lên</span>
                         <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(qIndex, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Hoặc nhập dán URL ảnh" 
                    style={{ fontSize: '0.8rem', marginTop: '1rem' }}
                    value={q.image}
                    onChange={(e) => updateQuestion(qIndex, 'image', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button 
            className="btn btn-ghost" 
            onClick={addQuestion} 
            style={{ 
              height: '80px', border: '2px dashed var(--border)', 
              borderRadius: '24px', opacity: 0.6, fontSize: '1.2rem', 
              display: 'flex', gap: '1rem' 
            }}
          >
            <Plus size={24} /> THÊM CÂU HỎI MỚI
          </button>
        </div>
      </div>
      <style>{`
        .screen-center { height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
