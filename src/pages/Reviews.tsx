import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { reviewsApi, Review } from '../store';
import { motion } from 'framer-motion';

export default function Reviews() {
  const { user } = useAuth();
  const [publicReviews, setPublicReviews] = useState<Review[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const [all, mine] = await Promise.all([
        reviewsApi.list(50),
        reviewsApi.userReviews(),
      ]);
      setPublicReviews(all);
      setMyReviews(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cardVariants = {
    hidden: { y: 24, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } },
  };

  const statusLabel = (s?: string) => {
    if (s === 'pending') return { text: 'На модерации', color: '#fbbf24' };
    if (s === 'rejected') return { text: 'Отклонён', color: '#ef4444' };
    return { text: 'Опубликован', color: '#34d399' };
  };

  const renderReviewCard = (review: Review, showAuthor = true) => {
    const st = statusLabel(review.status);
    const isMine = myReviews.some(m => m.id === review.id);
    return (
      <motion.div
        key={review.id}
        variants={cardVariants}
        whileHover={{ y: -6 }}
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? 18 : 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <i
                key={star}
                className="fas fa-star"
                style={{
                  fontSize: 16,
                  color: star <= review.rating ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
          {isMine && review.status && review.status !== 'approved' && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: `${st.color}22`, color: st.color }}>
              {st.text}
            </span>
          )}
        </div>
        <p style={{ lineHeight: 1.65, color: 'var(--text-gray)', margin: '0 0 18px', fontSize: 14 }}>{review.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {(showAuthor ? review.userName : user?.username)?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
              {showAuthor ? review.userName : user?.username}
              {isMine && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)' }}>(вы)</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 20px' }}>
        <div style={{ height: 36, width: 240, background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 24 }} />
          ))}
        </div>
      </div>
    );
  }

  const hasMyReview = myReviews.length > 0;
  const canWriteReview = !hasMyReview;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 28 : 34, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Отзывы клиентов</h1>
          <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: 14 }}>
            Все опубликованные отзывы после модерации
          </p>
        </div>
        {canWriteReview && (
          <Link to="/dashboard/review/create" className="ac-btn ac-btn-primary" style={{ textDecoration: 'none' }}>
            <i className="fas fa-plus" /> Написать отзыв
          </Link>
        )}
      </div>

      {hasMyReview && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Ваш отзыв</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 480px)' }}>
            {myReviews.map(r => renderReviewCard(r, false))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Все отзывы {publicReviews.length > 0 && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>({publicReviews.length})</span>}
        </h2>
        {publicReviews.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '56px 24px',
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <i className="fas fa-star" style={{ fontSize: 40, color: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-dim)', marginBottom: 20 }}>Пока нет опубликованных отзывов</p>
            {canWriteReview && (
              <Link to="/dashboard/review/create" className="ac-btn ac-btn-primary" style={{ textDecoration: 'none' }}>
                Стать первым
              </Link>
            )}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {publicReviews.map(r => renderReviewCard(r, true))}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}
