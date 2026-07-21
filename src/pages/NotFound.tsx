import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found-page site-page-below-banner">
      <div className="not-found-card">
        <div className="not-found-code">404</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Страница не найдена</h1>
        <p style={{ fontSize: 15, color: 'var(--text-gray)', marginBottom: 28, lineHeight: 1.6 }}>
          Возможно, она была перемещена, или вы указали неверный адрес. Проверьте URL или вернитесь на
          главную.
        </p>
        <Link to="/" className="ac-btn ac-btn-primary" style={{ textDecoration: 'none' }}>
          <i className="fas fa-home" style={{ marginRight: 8 }} />
          Вернуться на главную
        </Link>
        <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text-dim)' }}>
          <i className="fas fa-compass" style={{ marginRight: 6, opacity: 0.5 }} />
          Кажется, вы забрели не туда
        </p>
      </div>
    </div>
  );
}
