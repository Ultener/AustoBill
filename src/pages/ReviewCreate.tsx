import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { reviewsApi, serversApi } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReviewCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasServer, setHasServer] = useState<boolean | null>(null);
  const [hasReview, setHasReview] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Адаптивность
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    serversApi.list().then(servers => {
      setHasServer(servers.length > 0);
    });
    reviewsApi.userReviews().then(reviews => {
      if (reviews.length > 0) {
        setHasReview(true);
        if (reviews.some(r => r.status === 'pending')) setReviewPending(true);
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (text.trim().length < 3) {
      setError('Текст отзыва должен содержать минимум 3 символа');
      return;
    }
    setLoading(true);
    try {
      const res = await reviewsApi.create(rating, text);
      setSubmitSuccess(res.message || 'Отзыв отправлен на модерацию');
      setHasReview(true);
      setReviewPending(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке отзыва');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    setCharCount(value.length);
  };

  // Анимации
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const starVariants = {
    hidden: { scale: 0 },
    visible: (i: number) => ({
      scale: 1,
      transition: { delay: i * 0.05, type: 'spring', stiffness: 400, damping: 15 },
    }),
  };

  // Адаптивный базовый стиль кнопки-градиента
  const buttonGradientStyle: React.CSSProperties = {
    borderRadius: '40px',
    padding: isMobile ? '12px 22px' : '14px 28px',
    fontWeight: 600,
    fontSize: isMobile ? '14px' : '15px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    border: 'none',
  };

  // Общий паддинг контейнера
  const containerPadding = isMobile ? '0 16px' : '0 20px';

  if (hasServer === false) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: '0 auto', padding: containerPadding }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(12px)',
            borderRadius: 32,
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
            padding: isMobile ? 32 : 48,
          }}
        >
          <div
            style={{
              width: isMobile ? 64 : 80,
              height: isMobile ? 64 : 80,
              background: 'rgba(239,68,68,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <i className="fas fa-exclamation-circle" style={{ fontSize: isMobile ? 32 : 40, color: '#f87171' }} />
          </div>
          <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, marginBottom: 12, color: '#fff' }}>Невозможно оставить отзыв</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 28, fontSize: isMobile ? 13 : 14 }}>Только клиенты с активными серверами могут оставлять отзывы.</p>
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={() => navigate('/dashboard/purchase')}
            style={buttonGradientStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundPosition = '100% 0%';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundPosition = '0% 0%';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Приобрести сервер
          </button>
        </div>
      </motion.div>
    );
  }

  if (hasReview) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: '0 auto', padding: containerPadding }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(12px)',
            borderRadius: 32,
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
            padding: isMobile ? 32 : 48,
          }}
        >
          <div
            style={{
              width: isMobile ? 64 : 80,
              height: isMobile ? 64 : 80,
              background: reviewPending ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <i
              className={`fas ${reviewPending ? 'fa-hourglass-half' : 'fa-check-circle'}`}
              style={{ fontSize: isMobile ? 32 : 40, color: reviewPending ? '#fbbf24' : '#34d399' }}
            />
          </div>
          <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, marginBottom: 12, color: '#fff' }}>
            {reviewPending ? 'Отзыв на модерации' : 'Вы уже оставили отзыв'}
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 28, fontSize: isMobile ? 13 : 14 }}>
            {submitSuccess ||
              (reviewPending
                ? 'Спасибо! Администратор проверит отзыв — после одобрения он появится на сайте.'
                : 'Спасибо за ваше мнение! Редактирование пока не поддерживается.')}
          </p>
          <button
            onClick={() => navigate('/dashboard/reviews')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 40,
              padding: isMobile ? '10px 20px' : '12px 24px',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.2s',
              fontSize: isMobile ? '14px' : '15px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Вернуться к отзывам
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ maxWidth: 600, margin: '0 auto', padding: containerPadding }}
    >
      {/* Заголовок */}
      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            fontSize: isMobile ? 26 : 32,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #fff, #a5b4fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 8,
          }}
        >
          Оставить отзыв
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ color: 'var(--text-dim)', fontSize: isMobile ? 13 : 14 }}
        >
          Поделитесь впечатлениями о нашем хостинге
        </motion.p>
      </div>

      {/* Форма */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(12px)',
          borderRadius: 32,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? 20 : 32,
        }}
      >
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '14px 18px',
              borderRadius: 24,
              marginBottom: 24,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <i className="fas fa-exclamation-circle" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Рейтинг */}
          <div style={{ marginBottom: isMobile ? 20 : 28 }}>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 500, color: 'var(--text-gray)', fontSize: isMobile ? 13 : 14 }}>
              Ваша оценка
            </label>
            <div style={{ display: 'flex', gap: isMobile ? 8 : 12, fontSize: isMobile ? 24 : 28 }}>
              {[1, 2, 3, 4, 5].map((star, idx) => (
                <motion.i
                  key={star}
                  custom={idx}
                  variants={starVariants}
                  initial="hidden"
                  animate="visible"
                  className="fas fa-star"
                  style={{
                    cursor: 'pointer',
                    color: (hoverRating || rating) >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                    transition: 'color 0.1s, transform 0.1s',
                    filter: (hoverRating || rating) >= star ? 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' : 'none',
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                />
              ))}
            </div>
          </div>

          {/* Текст отзыва */}
          <div style={{ marginBottom: isMobile ? 20 : 28 }}>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 500, color: 'var(--text-gray)', fontSize: isMobile ? 13 : 14 }}>
              Ваш отзыв
            </label>
            <div
              style={{
                position: 'relative',
                border: `2px solid ${isFocused ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 24,
                transition: 'border 0.2s',
              }}
            >
              <textarea
                rows={isMobile ? 4 : 5}
                placeholder="Напишите, что вам понравилось или что можно улучшить..."
                value={text}
                onChange={handleTextChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                required
                minLength={3}
                style={{
                  width: '100%',
                  padding: isMobile ? '14px 16px' : '16px 18px',
                  background: '#0a0a0f',
                  borderRadius: 24,
                  border: 'none',
                  color: '#fff',
                  fontSize: isMobile ? 13 : 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 16,
                  fontSize: 11,
                  color: charCount < 3 ? '#f87171' : 'var(--text-dim)',
                }}
              >
                {charCount} / мин. 3
              </div>
            </div>
          </div>

          {/* Кнопка отправки */}
          <motion.button
            type="submit"
            className="ac-btn ac-btn-primary"
            disabled={loading}
            style={buttonGradientStyle}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundPosition = '100% 0%';
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundPosition = '0% 0%';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
            }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? <i className="fas fa-spinner fa-spin" /> : 'Отправить отзыв'}
          </motion.button>
        </form>

        {/* Примечание */}
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          <i className="fas fa-star" style={{ marginRight: 6, color: '#fbbf24' }} />
          Ваше мнение помогает нам становиться лучше
        </p>
      </div>
    </motion.div>
  );
}