import { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Tariff, plansApi, reviewsApi, Review } from '../store';
import Logo, { APP_NAME } from '../components/Logo';

const TARIFF_TYPES = ['game', 'coding', 'vps'] as const;
type TariffType = (typeof TARIFF_TYPES)[number];

function filterPlansByType(list: Tariff[], type: TariffType): Tariff[] {
  return list.filter(t => t.type === type);
}

const HERO_IMAGE = '/assets/img/minecraft-hero.svg';

const WHY_US = [
  {
    img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
    title: 'Серверное оборудование',
    lead: 'Производительность без компромиссов',
    desc: 'AMD EPYC, NVMe SSD и быстрая память — ваш Minecraft-сервер держит TPS стабильно даже при онлайне.',
    perks: ['AMD EPYC / Ryzen', 'NVMe диски', 'DDR4 ECC'],
  },
  {
    img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
    title: 'DDoS-защита',
    lead: 'Ваш сервер всегда онлайн',
    desc: 'Многоуровневая фильтрация трафика отражает атаки до того, как они дойдут до вашего мира.',
    perks: ['Фильтрация L3–L7', 'Автоматический scrub', 'Мониторинг 24/7'],
  },
  {
    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    title: 'Поддержка',
    lead: 'Живые специалисты, не боты',
    desc: 'Поможем с установкой ядра, плагинов и миграцией с другого хостинга.',
    perks: ['Ответ ~3 мин', 'Discord и тикеты', 'Гайды по настройке'],
  },
];

const FAQ = [
  { q: 'Как быстро создаётся сервер?', a: 'После оплаты сервер разворачивается автоматически за 1–3 минуты. Вы получите доступ в панели Pterodactyl.' },
  { q: 'Можно ли перенести мир с другого хостинга?', a: 'Да. Загрузите архив через SFTP или File Manager в панели — поддержка поможет при необходимости.' },
  { q: 'Какие ядра Minecraft доступны?', a: 'Paper, Purpur, Spigot, Vanilla, Forge, Fabric и другие — выбираете при заказе.' },
  { q: 'Есть ли бесплатный тариф?', a: 'Да, если он включён в тарифной сетке — оформляется как обычный заказ за 0₽.' },
  { q: 'Где расположены серверы?', a: 'Игровые и кодинг серверы доступны в двух локациях в Германии (Германия 1 и Германия 2) — выбираете при заказе. VDS размещаются в том же регионе.' },
];

const rotatingTexts = ['не упадут', 'не подведут', 'не лагают', 'не тормозят', 'не ломаются'];

const NAV_ITEMS = [
  { id: 'advantages', label: 'Почему мы' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'reviews', label: 'Отзывы' },
  { id: 'faq', label: 'FAQ' },
] as const;

function TariffPlanCard({ tariff: t, index: i }: { tariff: Tariff; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.05 }}
      className="ac-card"
      style={{
        padding: 28,
        position: 'relative',
        borderColor: t.popular ? 'rgba(255,255,255,0.25)' : undefined,
      }}
    >
      {t.popular && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#000',
            background: '#fff',
            padding: '4px 10px',
            borderRadius: 100,
          }}
        >
          Популярный
        </span>
      )}
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>{t.tier}</p>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12 }}>{t.name}</h3>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}>
          {t.price <= 0 ? 'Бесплатно' : `${t.price}₽`}
        </span>
        {t.price > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 14 }}> / мес</span>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-gray)', marginBottom: 20, minHeight: 40 }}>{t.description}</p>
      <ul style={{ listStyle: 'none', marginBottom: 24, padding: 0 }}>
        {t.features.slice(0, 5).map((f, fi) => (
          <li key={fi} style={{ fontSize: 13, color: 'var(--text-gray)', marginBottom: 8, display: 'flex', gap: 8 }}>
            <i className="fas fa-check" style={{ color: '#fff', fontSize: 10, marginTop: 4 }} />
            {f}
          </li>
        ))}
      </ul>
      <Link to="/dashboard/purchase" className="ac-btn ac-btn-primary" style={{ width: '100%' }}>
        Заказать
      </Link>
    </motion.div>
  );
}

export default function Landing() {
  const [pinned, setPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tariffType, setTariffType] = useState<TariffType>('game');
  const [rotatingTextIndex, setRotatingTextIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 60]);

  useEffect(() => {
    const t = setInterval(() => setRotatingTextIndex(i => (i + 1) % rotatingTexts.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    plansApi.list().then(setTariffs).catch(() => {});
    reviewsApi.list(12).then(setReviews).catch(() => {});
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) return;
    intervalRef.current = setInterval(() => setReviewIndex(i => (i + 1) % reviews.length), 6000);
    return () => clearInterval(intervalRef.current);
  }, [reviews.length]);

  const filteredTariffs = useMemo(
    () => filterPlansByType(tariffs, tariffType),
    [tariffs, tariffType],
  );

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.div className="landing-page" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,255,255,0.04), transparent)',
          zIndex: 0,
        }}
      />

      <header
        className={`landing-header${pinned || menuOpen ? ' landing-header--solid' : ''}${menuOpen ? ' landing-header--menu-open' : ''}`}
      >
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="ac-container landing-header__bar"
        >
          <div className="landing-header__brand">
            <Logo to="/" size={isMobile ? 32 : 38} showText={!isMobile} />
            {isMobile && <span className="landing-header__brand-text">{APP_NAME}</span>}
          </div>
          {!isMobile && (
            <nav className="landing-header__nav">
              {NAV_ITEMS.map(({ id, label }) => (
                <button key={id} type="button" className="landing-header__nav-link" onClick={() => scrollTo(id)}>
                  {label}
                </button>
              ))}
              <Link to="/status" className="landing-header__nav-link" style={{ textDecoration: 'none' }}>
                Статус
              </Link>
              <Link to="/login" className="ac-btn ac-btn-primary" style={{ marginLeft: 8, padding: '10px 20px', fontSize: 13 }}>
                Кабинет
              </Link>
            </nav>
          )}
          {isMobile && (
            <button
              type="button"
              className="landing-header__toggle"
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'}`} />
            </button>
          )}
        </motion.div>

        <AnimatePresence>
          {isMobile && menuOpen && (
            <>
              <motion.button
                key="landing-menu-backdrop"
                type="button"
                className="landing-header__backdrop"
                aria-label="Закрыть меню"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
              />
              <motion.nav
                key="landing-menu-panel"
                className="landing-header__mobile-menu ac-container"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                {NAV_ITEMS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className="landing-header__mobile-link"
                    onClick={() => scrollTo(id)}
                  >
                    {label}
                  </button>
                ))}
                <Link
                  to="/status"
                  className="landing-header__mobile-link"
                  onClick={() => setMenuOpen(false)}
                >
                  Статус
                </Link>
                <Link
                  to="/login"
                  className="ac-btn ac-btn-primary landing-header__mobile-cta"
                  onClick={() => setMenuOpen(false)}
                >
                  Личный кабинет
                </Link>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* HERO */}
      <section
        className={`ac-section landing-hero${isMobile ? ' landing-hero--mobile' : ''}`}
        style={{ paddingBottom: 60, position: 'relative', zIndex: 1 }}
      >
        <div className="ac-container">
          <div className="landing-hero__grid">
            <motion.div className="landing-hero__copy" style={{ y: heroY }}>
              <div className="ac-label">Minecraft-хостинг · {APP_NAME}</div>
              <h1 className="ac-title landing-hero__title" style={{ marginBottom: 20 }}>
                Серверы, которые{' '}
                <span className="landing-hero__rotate">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotatingTexts[rotatingTextIndex]}
                      initial={{ y: 24, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -24, opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="landing-hero__rotate-word"
                    >
                      {rotatingTexts[rotatingTextIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h1>
              <p className="ac-subtitle landing-hero__subtitle" style={{ marginBottom: 32 }}>
                Запустите Minecraft-сервер за минуту. Мощное железо, DDoS-защита и панель Pterodactyl.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="landing-hero__actions"
              >
                <button type="button" className="ac-btn ac-btn-primary" onClick={() => scrollTo('pricing')}>
                  Выбрать тариф <i className="fas fa-arrow-right" style={{ fontSize: 12 }} />
                </button>
                <Link to="/register" className="ac-btn ac-btn-ghost">
                  Регистрация
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              className="landing-hero__visual"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="ac-card landing-hero__image-wrap"
              >
                <img
                  src={HERO_IMAGE}
                  alt="Minecraft hosting"
                  className="landing-hero__image"
                />
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="landing-hero__badge"
                >
                  <motion.div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-dim)' }}>Статус нод</span>
                    <span style={{ color: '#fff' }}><span style={{ color: '#22c55e' }}>●</span> Online</span>
                  </motion.div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-gray)' }}>Германия · NVMe</div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="advantages" className="ac-section" style={{ background: 'var(--bg-elevated)', position: 'relative', zIndex: 1 }}>
        <div className="ac-container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="ac-label">Почему мы</div>
            <h2 className="ac-title">Инфраструктура уровня проекта</h2>
            <p className="ac-subtitle" style={{ margin: '16px auto 0' }}>
              Крупный заголовок — о сути. Ниже — конкретные преимущества по пунктам.
            </p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
            style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
          >
            {WHY_US.map((block, i) => (
              <motion.div
                key={block.title}
                className={`landing-why__row${i % 2 === 1 ? ' landing-why__row--reverse' : ''}`}
                variants={{ hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0 } }}
              >
                <motion.div className="landing-why__media">
                  <img
                    src={block.img}
                    alt={block.title}
                    className="landing-why__image"
                    loading="lazy"
                  />
                </motion.div>
                <motion.div className="landing-why__text">
                  <h3 className="landing-why__lead">{block.lead}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {block.title}
                  </p>
                  <p style={{ fontSize: 15, color: 'var(--text-gray)', lineHeight: 1.7, marginBottom: 20 }}>{block.desc}</p>
                  <motion.div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {block.perks.map(p => (
                      <span
                        key={p}
                        style={{
                          fontSize: 12,
                          padding: '6px 12px',
                          borderRadius: 100,
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-gray)',
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </motion.div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="ac-section" style={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="ac-container"
        >
          <motion.div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="ac-label">Тарифы</div>
            <h2 className="ac-title">Выберите план</h2>
            <p style={{ marginTop: 12, color: 'var(--text-dim)', fontSize: 14 }}>
              <i className="fas fa-location-dot" style={{ marginRight: 6 }} />
              Локация: Германия
            </p>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36, flexWrap: 'wrap' }}>
            {TARIFF_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTariffType(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: tariffType === t ? '#fff' : 'var(--border-dim)',
                  background: tariffType === t ? '#fff' : 'transparent',
                  color: tariffType === t ? '#000' : 'var(--text-gray)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t === 'game' ? 'Игровые' : t === 'coding' ? 'Кодинг' : 'VDS'}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {filteredTariffs.length === 0 ? (
              <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-dim)', padding: 48 }}>
                Тарифы скоро появятся
              </p>
            ) : (
              filteredTariffs.map((t, i) => <TariffPlanCard key={t.id} tariff={t} index={i} />)
            )}
          </div>
        </motion.div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="ac-section" style={{ background: 'var(--bg-elevated)', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="ac-container"
        >
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="ac-label">Отзывы</div>
            <h2 className="ac-title">Что говорят клиенты</h2>
          </div>
          {reviews.length > 0 ? (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={reviews[reviewIndex].id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  className="ac-card"
                  style={{ padding: 32 }}
                >
                  <motion.div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <i
                        key={s}
                        className="fas fa-star"
                        style={{ color: s <= reviews[reviewIndex].rating ? '#fff' : 'var(--border-dim)', fontSize: 14 }}
                      />
                    ))}
                  </motion.div>
                  <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-gray)', marginBottom: 24 }}>
                    «{reviews[reviewIndex].text}»
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>{reviews[reviewIndex].userName}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {new Date(reviews[reviewIndex].createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
              {reviews.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                  {reviews.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewIndex(i)}
                      style={{
                        width: i === reviewIndex ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        border: 'none',
                        background: i === reviewIndex ? '#fff' : 'var(--border-dim)',
                        cursor: 'pointer',
                        transition: '0.3s',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Отзывов пока нет — будьте первым!</p>
          )}
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="ac-section" style={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="ac-container"
          style={{ maxWidth: 720 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="ac-label">FAQ</div>
            <h2 className="ac-title">Частые вопросы</h2>
          </div>
          {FAQ.map((item, i) => (
            <motion.div
              key={item.q}
              className="ac-card"
              style={{ marginBottom: 10, overflow: 'hidden' }}
            >
              <button
                type="button"
                className="landing-faq__question"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <i className={`fas fa-chevron-${openFaq === i ? 'up' : 'down'}`} aria-hidden />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-gray)', lineHeight: 1.6 }}>{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="ac-section" style={{ paddingTop: 0, position: 'relative', zIndex: 1 }}>
        <div className="ac-container">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="ac-card landing-cta"
          >
            <h2 className="ac-title" style={{ marginBottom: 12 }}>Готовы начать?</h2>
            <p className="ac-subtitle" style={{ margin: '0 auto 24px' }}>Регистрация за минуту. Оплата с баланса.</p>
            <Link to="/register" className="ac-btn ac-btn-primary">
              Создать аккаунт
            </Link>
          </motion.div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-dim)', padding: '48px 0 24px', position: 'relative', zIndex: 1 }}>
        <div className="ac-container" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 40 }}>
          <div>
            <Logo to="/" size={32} />
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-dim)' }}>© 2026 {APP_NAME}. Игровой хостинг.</p>
          </div>
          <motion.div>
            <h4 style={{ color: '#fff', marginBottom: 12, fontSize: 14 }}>Навигация</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={() => scrollTo('pricing')} style={{ background: 'none', border: 'none', color: 'var(--text-gray)', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>
                Тарифы
              </button>
              <Link to="/status" style={{ color: 'var(--text-gray)', fontSize: 13, textDecoration: 'none' }}>Статус</Link>
            </div>
          </motion.div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: 12, fontSize: 14 }}>Документы</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/policy" style={{ color: 'var(--text-gray)', fontSize: 13, textDecoration: 'none' }}>Конфиденциальность</Link>
              <Link to="/offert" style={{ color: 'var(--text-gray)', fontSize: 13, textDecoration: 'none' }}>Офферта</Link>
              <Link to="/terms" style={{ color: 'var(--text-gray)', fontSize: 13, textDecoration: 'none' }}>Соглашение</Link>
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
