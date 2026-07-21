import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type AdminHubCard<T extends string> = {
  id: T;
  label: string;
  description: string;
  icon: string;
  group: string;
  count?: number;
};

type AdminLayoutProps<T extends string> = {
  section: T | null;
  onSectionChange: (id: T | null) => void;
  cards: AdminHubCard<T>[];
  sectionTitle?: string;
  sectionDescription?: string;
  msg?: string;
  msgType?: 'success' | 'error';
  onDismissMsg?: () => void;
  onRefresh?: () => void;
  backLabel?: string;
  onBack?: () => void;
  children: ReactNode;
};

export function AdminLayout<T extends string>({
  section,
  onSectionChange,
  cards,
  sectionTitle,
  sectionDescription,
  msg,
  msgType = 'success',
  onDismissMsg,
  onRefresh,
  backLabel = 'К разделам',
  onBack,
  children,
}: AdminLayoutProps<T>) {
  const groups = Array.from(new Set(cards.map(c => c.group)));

  const handleBack = () => {
    if (onBack) onBack();
    else onSectionChange(null);
  };

  if (section === null) {
    return (
      <div className="admin-v2 admin-v2--hub bill-page--fill">
        <header className="admin-hub__hero">
          <div className="admin-hub__hero-glow" aria-hidden />
          <div className="admin-hub__hero-inner">
            <div className="admin-hub__badge">
              <i className="fas fa-shield-halved" />
              Панель управления
            </div>
            <h1 className="admin-hub__title">Админ-центр</h1>
            <p className="admin-hub__desc">Выберите раздел для работы с системой AustoCloud</p>
          </div>
        </header>

        {groups.map(group => (
          <section key={group} className="admin-hub__section">
            <h2 className="admin-hub__group-title">{group}</h2>
            <div className="admin-hub__grid">
              {cards
                .filter(c => c.group === group)
                .map((card, i) => (
                  <motion.button
                    key={card.id}
                    type="button"
                    className="admin-hub-card"
                    onClick={() => onSectionChange(card.id)}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.28 }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="admin-hub-card__icon">
                      <i className={`fas ${card.icon}`} />
                    </span>
                    <span className="admin-hub-card__body">
                      <span className="admin-hub-card__label">{card.label}</span>
                      <span className="admin-hub-card__text">{card.description}</span>
                    </span>
                    {card.count !== undefined ? (
                      <span className="admin-hub-card__count">{card.count > 99 ? '99+' : card.count}</span>
                    ) : null}
                    <i className="fas fa-arrow-right admin-hub-card__arrow" />
                  </motion.button>
                ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-v2 admin-v2--section bill-page--fill">
      <motion.div
        className="admin-section-screen"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="admin-section__header">
          <div className="admin-section__header-row">
            <button type="button" className="admin-section__back" onClick={handleBack}>
              <i className="fas fa-arrow-left" aria-hidden />
              <span className="admin-section__back-full">{backLabel}</span>
              <span className="admin-section__back-short">Назад</span>
            </button>
            {onRefresh ? (
              <button type="button" className="ac-btn ac-btn-ghost admin-section__refresh" onClick={onRefresh}>
                <i className="fas fa-arrows-rotate" aria-hidden />
                <span className="admin-section__refresh-text">Обновить</span>
              </button>
            ) : null}
          </div>
          <div className="admin-section__titles">
            <h1 className="admin-section__title">{sectionTitle}</h1>
            {sectionDescription ? <p className="admin-section__desc">{sectionDescription}</p> : null}
          </div>
        </header>

        <AnimatePresence>
          {msg ? (
            <motion.div
              className={`admin-toast admin-toast--${msgType}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
            >
              <span>
                <i className={`fas ${msgType === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                {msg}
              </span>
              {onDismissMsg ? (
                <button type="button" className="admin-toast__close" onClick={onDismissMsg} aria-label="Закрыть">
                  <i className="fas fa-times" />
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="admin-section__body">{children}</div>
      </motion.div>
    </div>
  );
}
