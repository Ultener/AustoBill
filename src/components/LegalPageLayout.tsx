import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo, { APP_NAME } from './Logo';

type LegalPage = 'policy' | 'offert' | 'terms';

const LEGAL_LINKS: { path: string; label: string; id: LegalPage }[] = [
  { path: '/policy', label: 'Конфиденциальность', id: 'policy' },
  { path: '/offert', label: 'Оферта', id: 'offert' },
  { path: '/terms', label: 'Соглашение', id: 'terms' },
];

export const legalP: CSSProperties = {
  color: 'var(--text-gray)',
  lineHeight: 1.7,
  marginBottom: 12,
};

export const legalPMuted: CSSProperties = {
  ...legalP,
  marginLeft: 20,
  marginBottom: 8,
};

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 16,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 4,
            height: 22,
            background: '#fff',
            borderRadius: 2,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

type LegalPageLayoutProps = {
  title: string;
  updated: string;
  current: LegalPage;
  children: ReactNode;
};

export default function LegalPageLayout({ title, updated, current, children }: LegalPageLayoutProps) {
  return (
    <div className="site-page-with-sticky-nav" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-white)' }}>
      <header
        className="site-sticky-header"
        style={{
          borderBottom: '1px solid var(--border-dim)',
          background: 'rgba(5,5,5,0.92)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <motion.div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Logo to="/" size={34} />
          <Link to="/" className="ac-btn ac-btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
            <i className="fas fa-arrow-left" style={{ marginRight: 8 }} />
            На главную
          </Link>
        </motion.div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 64px' }}>
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="ac-card"
          style={{ padding: '40px 48px', marginBottom: 28 }}
        >
          <div className="ac-label" style={{ marginBottom: 12 }}>
            Документы · {APP_NAME}
          </div>
          <h1 className="ac-title" style={{ fontSize: 36, marginBottom: 12 }}>
            {title}
          </h1>
          <p
            style={{
              color: 'var(--text-dim)',
              borderBottom: '1px solid var(--border-dim)',
              paddingBottom: 16,
              marginBottom: 32,
              fontSize: 14,
            }}
          >
            <i className="fas fa-calendar-alt" style={{ marginRight: 8 }} />
            Последнее обновление: {updated}
          </p>

          <div style={{ fontSize: 15 }}>{children}</div>
        </motion.article>

        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
          {LEGAL_LINKS.map(link => (
            <Link
              key={link.id}
              to={link.path}
              className="ac-btn"
              style={{
                padding: '8px 16px',
                fontSize: 13,
                borderRadius: 100,
                textDecoration: 'none',
                background: current === link.id ? '#fff' : 'var(--bg-card)',
                color: current === link.id ? '#000' : 'var(--text-gray)',
                border: '1px solid var(--border-dim)',
                fontWeight: 600,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ textAlign: 'center' }}>
          <Link to="/" className="ac-btn ac-btn-primary">
            <i className="fas fa-home" style={{ marginRight: 8 }} />
            Вернуться на главную
          </Link>
        </div>
      </main>
    </div>
  );
}
