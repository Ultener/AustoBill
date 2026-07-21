import { useState, useEffect } from 'react';
import { reviewsApi, type ReviewStatus } from '../store';

const statusLabel: Record<ReviewStatus, string> = {
  pending: 'На модерации',
  approved: 'Опубликован',
  rejected: 'Отклонён',
};

export default function AdminReviews() {
  const [reviews, setReviews] = useState<(Awaited<ReturnType<typeof reviewsApi.adminList>>)[number][]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');

  const load = () => {
    setLoading(true);
    reviewsApi.adminList().then(setReviews).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (id: string, fn: () => Promise<unknown>, ok: (id: string) => void) => {
    setActionId(id);
    try {
      await fn();
      ok(id);
    } catch {
      alert('Ошибка');
    } finally {
      setActionId('');
    }
  };

  if (loading) {
    return <div className="bill-loading"><i className="fas fa-circle-notch fa-spin" /> Загрузка…</div>;
  }

  const pending = reviews.filter(r => r.status === 'pending').length;

  return (
    <div className="bill-page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <header className="bill-page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="ac-label">Админ</div>
          <h1 className="bill-page-title">Модерация отзывов</h1>
          <p className="bill-page-sub">
            {pending > 0 ? `Ожидают проверки: ${pending}` : 'Новых отзывов на модерации нет'}
          </p>
        </div>
        <button type="button" className="ac-btn ac-btn-ghost" onClick={load}>
          <i className="fas fa-sync-alt" /> Обновить
        </button>
      </header>

      {reviews.length === 0 ? (
        <div className="bill-empty">
          <i className="fas fa-star" />
          <p>Отзывов нет</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Статус</th>
                <th>Оценка</th>
                <th>Текст</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id}>
                  <td data-label="Пользователь">{r.userName}</td>
                  <td data-label="Email">{r.email}</td>
                  <td data-label="Статус">
                    <span className={`admin-badge admin-badge--${r.status === 'pending' ? 'warn' : r.status === 'approved' ? 'ok' : 'muted'}`}>
                      {statusLabel[r.status || 'approved']}
                    </span>
                  </td>
                  <td data-label="Оценка">{r.rating} ★</td>
                  <td data-label="Текст" className="admin-table__text">{r.text}</td>
                  <td data-label="Дата">{new Date(r.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td data-label="Действия" className="admin-table__actions">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="ac-btn ac-btn-primary"
                          disabled={!!actionId}
                          onClick={() =>
                            run(r.id, () => reviewsApi.adminApprove(r.id), id =>
                              setReviews(prev => prev.map(x => (x.id === id ? { ...x, status: 'approved' } : x))),
                            )
                          }
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="ac-btn ac-btn-ghost"
                          disabled={!!actionId}
                          onClick={() =>
                            run(r.id, () => reviewsApi.adminReject(r.id), id =>
                              setReviews(prev => prev.map(x => (x.id === id ? { ...x, status: 'rejected' } : x))),
                            )
                          }
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="ac-btn ac-btn-ghost"
                      style={{ color: '#f87171' }}
                      disabled={!!actionId}
                      onClick={() => {
                        if (!confirm('Удалить?')) return;
                        run(r.id, () => reviewsApi.adminDelete(r.id), id =>
                          setReviews(prev => prev.filter(x => x.id !== id)),
                        );
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
