import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useNavigate, useLocation } from 'react-router-dom';

const isE164Phone = (value) => /^\+[1-9]\d{7,14}$/.test((value || '').trim());
const isEmail = (value) => (value || '').includes('@');

const getUsernameFromToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.sub || null;
  } catch {
    return null;
  }
};

const Login = () => {
  const [mode, setMode] = useState('login'); // login | register | verify | forgot
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [verificationIdentifier, setVerificationIdentifier] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredPhone, setRegisteredPhone] = useState('');

  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/auth/login', {
        username: username.trim(),
        password: password.trim()
      });

      const token = response.data.token;
      if (token) {
        localStorage.setItem('token', token);
        const usernameFromToken = getUsernameFromToken(token);
        localStorage.setItem('username', usernameFromToken || username.trim());
        navigate(from, { replace: true });
      }
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Giriş başarısız.');
    }
  };

  const sendVerificationCode = async (identifier) => {
    const target = identifier.trim();
    if (!target) {
      alert('Lütfen e-posta veya telefon girin.');
      return;
    }
    if (!isEmail(target) && !isE164Phone(target)) {
      alert('Telefon numarası +90... formatında olmalıdır.');
      return;
    }

    try {
      const response = await api.post('/api/auth/send-verification', { identifier: target });
      alert(response.data?.message || 'Doğrulama kodu gönderildi.');
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Kod gönderilemedi.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanPassword !== cleanConfirm) {
      alert('Şifreler eşleşmiyor.');
      return;
    }
    if (!isE164Phone(cleanPhone)) {
      alert('Telefon numarası +90... formatında olmalıdır.');
      return;
    }

    try {
      await api.post('/api/auth/register', {
        username: cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        password: cleanPassword
      });

      setRegisteredEmail(cleanEmail);
      setRegisteredPhone(cleanPhone);
      setVerificationIdentifier(cleanEmail);
      setVerificationCode('');
      setMode('verify');
      await sendVerificationCode(cleanEmail);
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Kayıt sırasında hata oluştu.');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const identifier = verificationIdentifier.trim();

    if (!identifier) {
      alert('Lütfen e-posta veya telefon girin.');
      return;
    }
    if (!isEmail(identifier) && !isE164Phone(identifier)) {
      alert('Telefon numarası +90... formatında olmalıdır.');
      return;
    }

    try {
      await api.post('/api/auth/verify', {
        identifier,
        code: verificationCode.trim()
      });

      alert('Doğrulama tamamlandı. Giriş yapabilirsiniz.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Doğrulama başarısız.');
    }
  };

  const sendResetCode = async () => {
    const target = resetIdentifier.trim();
    if (!target) {
      alert('Lütfen e-posta girin.');
      return;
    }
    if (!isEmail(target)) {
      alert('Şifre sıfırlama yalnızca e-posta ile yapılır.');
      return;
    }

    try {
      const response = await api.post('/api/auth/send-reset-code', { identifier: target });
      alert(response.data?.message || 'Şifre sıfırlama kodu gönderildi.');
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Şifre sıfırlama kodu gönderilemedi.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const identifier = resetIdentifier.trim();

    if (!identifier) {
      alert('Lütfen e-posta girin.');
      return;
    }
    if (!isEmail(identifier)) {
      alert('Şifre sıfırlama yalnızca e-posta ile yapılır.');
      return;
    }

    if (newPassword.trim() !== confirmNewPassword.trim()) {
      alert('Yeni şifreler eşleşmiyor.');
      return;
    }

    try {
      await api.post('/api/auth/reset-password', {
        identifier,
        code: resetCode.trim(),
        newPassword: newPassword.trim()
      });

      alert('Şifreniz güncellendi. Giriş yapabilirsiniz.');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCode('');
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data;
      alert(backendMessage || 'Şifre sıfırlama başarısız.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : mode === 'verify' ? handleVerify : handleResetPassword}
        className="p-10 bg-white rounded shadow-xl w-96"
      >
        {(mode === 'login' || mode === 'register') && (
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                mode === 'login' ? 'bg-white text-blue-700 shadow' : 'text-gray-500'
              }`}
            >
              Giriş
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                mode === 'register' ? 'bg-white text-blue-700 shadow' : 'text-gray-500'
              }`}
            >
              Kayıt Ol
            </button>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-5 text-gray-800">
          {mode === 'login' && 'Coshop Giriş'}
          {mode === 'register' && 'Coshop Kayıt'}
          {mode === 'verify' && 'Hesap Doğrulama'}
          {mode === 'forgot' && 'Şifre Sıfırlama'}
        </h2>

        {mode === 'login' && (
          <>
            <input
              type="text"
              placeholder="Kullanıcı Adı veya E-posta"
              className="w-full p-2 mb-4 border rounded"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Şifre"
              className="w-full p-2 mb-3 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="mb-6 text-sm text-blue-700 hover:underline"
            >
              Şifremi Unuttum
            </button>
          </>
        )}

        {mode === 'register' && (
          <>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              className="w-full p-2 mb-4 border rounded"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="E-posta"
              className="w-full p-2 mb-4 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="+905551112233"
              className="w-full p-2 mb-4 border rounded"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 -mt-2 mb-4">Telefonu uluslararası formatta girin (E.164).</p>
            <input
              type="password"
              placeholder="Şifre"
              className="w-full p-2 mb-4 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Şifre Tekrar"
              className="w-full p-2 mb-6 border rounded"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </>
        )}

        {mode === 'verify' && (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Kayıt tamamlandı. Girişten önce hesabınızı bir kez doğrulayın.
            </p>
            <input
              type="text"
              placeholder="E-posta veya Telefon"
              className="w-full p-2 mb-4 border rounded"
              value={verificationIdentifier}
              onChange={(e) => setVerificationIdentifier(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Doğrulama Kodu"
              className="w-full p-2 mb-4 border rounded"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
            />
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => sendVerificationCode(registeredEmail || verificationIdentifier)}
                className="flex-1 bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
              >
                E-posta Kodu
              </button>
              <button
                type="button"
                onClick={() => sendVerificationCode(registeredPhone || verificationIdentifier)}
                className="flex-1 bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
              >
                Telefon Kodu
              </button>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <p className="text-sm text-gray-600 mb-3">
              1. E-posta adresinizi girin ve kod gönderin. 2. Mailinize gelen kodu aşağıya yazın.
            </p>
            <input
              type="email"
              placeholder="E-posta"
              className="w-full p-2 mb-4 border rounded"
              value={resetIdentifier}
              onChange={(e) => setResetIdentifier(e.target.value)}
              required
            />
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={sendResetCode}
                className="w-full bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
              >
                Sıfırlama Kodu Gönder
              </button>
            </div>
            <input
              type="text"
              placeholder="Maildeki doğrulama kodu"
              className="w-full p-2 mb-4 border rounded"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Yeni Şifre"
              className="w-full p-2 mb-4 border rounded"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Yeni Şifre Tekrar"
              className="w-full p-2 mb-6 border rounded"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setMode('login')}
              className="mb-4 text-sm text-blue-700 hover:underline"
            >
              Girişe Dön
            </button>
          </>
        )}

        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {mode === 'login' && 'Giriş Yap'}
          {mode === 'register' && 'Kayıt Ol'}
          {mode === 'verify' && 'Kodu Doğrula'}
          {mode === 'forgot' && 'Şifreyi Güncelle'}
        </button>
      </form>
    </div>
  );
};

export default Login;
