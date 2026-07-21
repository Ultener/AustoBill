import { useEffect, useState, type CSSProperties } from 'react';
import { PromoCode, promoAdminApi, referralsApi, ReferralRegistration } from '../../store';
import { usePagination } from '../../hooks/usePagination';
import { AdminPagination } from '../../components/admin/AdminPagination';

const inputStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-dim)',
  background: 'var(--bg)',
  color: '#fff',
  fontSize: 13,
};

type PaginateProps = { paginateReset?: unknown[] };

export function AdminPromoTab({ paginateReset = [] }: PaginateProps) {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed' | 'balance'>('percent');
  const [value, setValue] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [perUser, setPerUser] = useState('1');
  const [minAmount, setMinAmount] = useState('0');
  const [msg, setMsg] = useState('');

  const load = () => promoAdminApi.list().then(setPromos).catch(() => {});
  useEffect(() => { load(); }, []);

  const promosPag = usePagination(promos, 6, paginateReset);

  const create = async () => {
    try {
      await promoAdminApi.create({
        code,
        type,
        value: Number(value),
        max_uses: maxUses ? Number(maxUses) : null,
        per_user_limit: Number(perUser) || 1,
        min_amount: Number(minAmount) || 0,
        active: 1,
      } as PromoCode & { code: string; type: string; value: number });
      setMsg('Промокод создан');
      setCode('');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const toggle = async (p: PromoCode) => {
    await promoAdminApi.update(p.id, { active: p.active ? 0 : 1 });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить промокод?')) return;
    await promoAdminApi.delete(id);
    load();
  };

  return (
    <div>
      {msg && <p style={{ marginBottom: 12, color: 'var(--text-gray)', fontSize: 13 }}>{msg}</p>}
      <div className="ac-card admin-section-card" style={{ marginBottom: 24 }}>
        <h3>Новый промокод</h3>
        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          <input placeholder="Код" value={code} onChange={e => setCode(e.target.value)} style={inputStyle} />
          <select value={type} onChange={e => setType(e.target.value as typeof type)} style={inputStyle}>
            <option value="percent">% скидка</option>
            <option value="fixed">Фикс. ₽</option>
            <option value="balance">На баланс</option>
          </select>
          <input placeholder="Значение" value={value} onChange={e => setValue(e.target.value)} style={inputStyle} />
          <input placeholder="Макс. использований" value={maxUses} onChange={e => setMaxUses(e.target.value)} style={inputStyle} />
          <input placeholder="На пользователя" value={perUser} onChange={e => setPerUser(e.target.value)} style={inputStyle} />
          <input placeholder="Мин. сумма" value={minAmount} onChange={e => setMinAmount(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" className="ac-btn ac-btn-primary" style={{ marginTop: 16 }} onClick={create}>
          Создать
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {promosPag.items.map(p => (
          <div key={p.id} className="ac-card admin-promo-row" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ color: '#fff' }}>{p.code}</strong>
              <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-dim)' }}>
                {p.type} · {p.value}{p.type === 'percent' ? '%' : '₽'} · {p.used_count}/{p.max_uses ?? '∞'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ac-btn ac-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => toggle(p)}>
                {p.active ? 'Выкл' : 'Вкл'}
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => remove(p.id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <AdminPagination
        page={promosPag.page}
        totalPages={promosPag.totalPages}
        total={promosPag.total}
        pageSize={promosPag.pageSize}
        onPageChange={promosPag.setPage}
      />
    </div>
  );
}

export function AdminReferralsTab({ paginateReset = [] }: PaginateProps) {
  const [summary, setSummary] = useState<{ referrer_id: string; referrer_username: string; referral_count: number }[]>([]);
  const [regs, setRegs] = useState<ReferralRegistration[]>([]);

  useEffect(() => {
    referralsApi.admin().then(d => {
      setSummary(d.summary || []);
      setRegs(d.registrations || []);
    }).catch(() => {});
  }, []);

  const summaryPag = usePagination(summary, 6, paginateReset);
  const regsPag = usePagination(regs, 6, paginateReset);

  return (
    <div>
      <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Топ рефереров</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {summary.length === 0 ? (
          <p className="admin-empty" style={{ padding: 24 }}>Пока нет рефералов</p>
        ) : (
          summaryPag.items.map(s => (
            <div key={s.referrer_id} className="ac-card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff' }}>{s.referrer_username}</span>
              <span style={{ color: 'var(--text-gray)' }}>{s.referral_count} рег.</span>
            </div>
          ))
        )}
      </div>
      {summary.length > 6 ? (
        <AdminPagination
          page={summaryPag.page}
          totalPages={summaryPag.totalPages}
          total={summaryPag.total}
          pageSize={summaryPag.pageSize}
          onPageChange={summaryPag.setPage}
        />
      ) : null}

      <h3 style={{ color: '#fff', margin: '24px 0 16px', fontSize: 16, fontWeight: 700 }}>Все регистрации по ссылке</h3>
      <div className="admin-table-wrap admin-table-wrap--cards">
        <table className="admin-table admin-table--stack">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Пригласил</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {regsPag.items.map(r => (
              <tr key={r.id}>
                <td data-label="Пользователь" className="admin-table__primary">{r.username}</td>
                <td data-label="Пригласил">{r.referrer_username || '—'}</td>
                <td data-label="Дата">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination
        page={regsPag.page}
        totalPages={regsPag.totalPages}
        total={regsPag.total}
        pageSize={regsPag.pageSize}
        onPageChange={regsPag.setPage}
      />
    </div>
  );
}
