import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { setToken, type BanInfo } from '../store';
import Logo from '../components/Logo';

export default function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('message');

    if (error) {
      const code = searchParams.get('code');
      const reason = searchParams.get('reason');
      const byIp = searchParams.get('byIp') === '1';
      if (code === 'ACCOUNT_BANNED' && reason) {
        navigate('/login', { state: { ban: { reason: decodeURIComponent(reason), byIp } satisfies BanInfo } });
        return;
      }
      alert(`Ошибка авторизации: ${decodeURIComponent(error)}`);
      navigate('/login');
      return;
    }

    if (token) {
      setToken(token);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async res => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (data.code === 'ACCOUNT_BANNED' && data.ban) {
              navigate('/login', { state: { ban: data.ban } });
              return;
            }
            throw new Error(data.error || 'Ошибка авторизации');
          }
          setUser(data.user);
          navigate('/dashboard');
        })
        .catch(() => {
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, setUser]);

  return (
    <div
      className="auth-page"
      style={{ flexDirection: 'column', gap: 24 }}
    >
      <Logo size={40} showText />
      <div className="ac-label">Авторизация через Discord</div>
      <div className="bill-loading">
        <i className="fas fa-circle-notch fa-spin" />
        <span>Подключаем аккаунт…</span>
      </div>
    </div>
  );
}
