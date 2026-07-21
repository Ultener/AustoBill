import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { transactionsApi, Transaction, promoApi, yoomoneyApi } from '../store';
import { PageHeader, BillingCard, BillingAlert } from '../components/billing/DashboardUI';
import {
  BillFormShell,
  BillField,
  BillInput,
  BillPresetGrid,
  BillPayMethods,
} from '../components/billing/BillForm';

const PRESETS = [100, 250, 500, 1000, 2500, 5000];

type PaymentMethod = 'yoomoney' | 'sbp' | 'crypto';

const PLATEGA_METHOD_LABELS: Record<'sbp' | 'crypto', string> = {
  sbp: 'СБП',
  crypto: 'Crypto',
};

export default function TopUp() {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState(250);
  const [custom, setCustom] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yoomoney');
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const [redirectTimer, setRedirectTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  useEffect(() => {
    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [redirectTimer]);

  useEffect(() => {
    loadTransactions();
    refreshUser();
  }, []);

  useEffect(() => {
    const onFocus = () => { refreshUser(); loadTransactions(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const loadTransactions = async () => {
    setLoadingHistory(true);
    try {
      const data = await transactionsApi.list();
      setTransactions(data);
    } catch (e) {
      console.error('Failed to load transactions', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const redirectWithNotice = (url: string, notice: string) => {
    setRedirectMessage(notice);
    const timer = setTimeout(() => {
      window.location.href = url;
    }, 5000);
    setRedirectTimer(timer);
  };

  const handleYooMoneyPay = async () => {
    if (finalAmount <= 0) return;
    setIsLoading(true);
    try {
      const data = await yoomoneyApi.create(finalAmount);
      redirectWithNotice(
        data.payment_url,
        `Через 5 секунд вы будете перенаправлены на оплату ${finalAmount} ₽ через YooMoney…`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка создания платежа YooMoney');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlategaPay = async (method: 'sbp' | 'crypto') => {
    if (finalAmount <= 0) return;
    setIsLoading(true);
    const methodLabel = PLATEGA_METHOD_LABELS[method];
    try {
      const response = await fetch('/api/platega/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('lmx_token')}`,
        },
        body: JSON.stringify({ amount: finalAmount, method }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Ошибка создания платежа через ${methodLabel}`);
      if (data.payment_url) {
        redirectWithNotice(data.payment_url, `Через 5 секунд — оплата ${finalAmount} ₽ через ${methodLabel}…`);
      } else throw new Error('Не получен URL для оплаты');
    } catch (err) {
      alert(err instanceof Error ? err.message : `Ошибка при создании платежа ${methodLabel}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPayHandler = () => {
    switch (paymentMethod) {
      case 'yoomoney': return handleYooMoneyPay;
      case 'sbp': return () => handlePlategaPay('sbp');
      case 'crypto': return () => handlePlategaPay('crypto');
      default: return handleYooMoneyPay;
    }
  };

  const getPayButtonText = () => {
    switch (paymentMethod) {
      case 'yoomoney': return 'Оплатить через YooMoney';
      case 'sbp': return 'Оплатить через СБП';
      case 'crypto': return 'Оплатить через Crypto';
      default: return 'Оплатить';
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleActivatePromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const res = await promoApi.activate(promoCode.trim());
      alert(res.message);
      setPromoCode('');
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Промокод не найден');
    }
  };

  const payMethods = [
    { id: 'yoomoney', label: 'YooMoney', icon: <img src="/assets/img/payments/yoomoney-logo.svg" alt="" style={{ height: 28 }} /> },
    { id: 'sbp', label: 'СБП', icon: <img src="/assets/img/payments/sbp-logo.svg" alt="" style={{ height: 28 }} /> },
    { id: 'crypto', label: 'Crypto', icon: <img src="/assets/img/payments/crypto-logo.svg" alt="" style={{ height: 28 }} /> },
  ];

  const disabled =
    finalAmount <= 0 || (custom && parseInt(custom) > 100000) || isLoading || redirectMessage !== null;

  return (
    <div className="bill-page">
      <PageHeader
        label="Биллинг"
        title="Пополнение баланса"
        subtitle="Выберите сумму и способ оплаты. Средства зачисляются после подтверждения платёжной системы."
        action={
          <div className="bill-stat-card bill-stat-card--accent" style={{ padding: '14px 22px', margin: 0 }}>
            <div className="bill-stat-label">Баланс</div>
            <div className="bill-stat-value" style={{ fontSize: 28 }}>
              {user?.balance?.toLocaleString()} ₽
            </div>
          </div>
        }
      />

      <AnimatePresence>
        {redirectMessage && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BillingAlert type="info">
              <i className="fas fa-hourglass-half" /> {redirectMessage}
            </BillingAlert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bill-topup-layout">
        <BillFormShell title="Сумма пополнения" subtitle="Быстрый выбор или своя сумма до 100 000 ₽">
          <BillField label="Пресеты">
            <BillPresetGrid
              values={PRESETS}
              selected={custom ? -1 : amount}
              onSelect={v => {
                setAmount(v);
                setCustom('');
              }}
            />
          </BillField>

          <BillField label="Своя сумма (₽)">
            <BillInput
              type="number"
              icon="fa-ruble-sign"
              placeholder="Введите сумму"
              min={1}
              max={100000}
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
            {custom && parseInt(custom) > 100000 && (
              <p className="bill-field__hint" style={{ color: '#f87171' }}>Максимум — 100 000 ₽</p>
            )}
          </BillField>

          <BillField label="Способ оплаты">
            <BillPayMethods methods={payMethods} value={paymentMethod} onChange={id => setPaymentMethod(id as PaymentMethod)} />
          </BillField>

          <div className="bill-topup-summary">
            <span className="bill-topup-summary__label">К оплате</span>
            <span className="bill-topup-summary__value">{finalAmount} ₽</span>
          </div>

          <button
            type="button"
            className="ac-btn ac-btn-primary"
            style={{ width: '100%', padding: '15px 24px', fontSize: 15 }}
            onClick={getPayHandler()}
            disabled={disabled}
          >
            {isLoading ? (
              <><i className="fas fa-spinner fa-spin" /> Подготовка…</>
            ) : redirectMessage ? (
              <><i className="fas fa-hourglass-half" /> Ожидание…</>
            ) : (
              <><i className="fas fa-external-link-alt" /> {getPayButtonText()}</>
            )}
          </button>

          <p className="bill-field__hint" style={{ textAlign: 'center' }}>
            <i className="fas fa-lock" style={{ marginRight: 6 }} />
            Безопасный редирект на платёжную форму
          </p>
        </BillFormShell>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <BillingCard>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fas fa-history" style={{ opacity: 0.7 }} /> История
            </h3>
            {loadingHistory ? (
              <div className="bill-loading">
                <i className="fas fa-circle-notch fa-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="bill-empty" style={{ padding: '32px 16px' }}>
                <i className="fas fa-wallet" />
                <p>Пополнений пока нет</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-dim)',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>+{tx.amount} ₽</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatDate(tx.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-gray)' }}>
                      {tx.status === 'completed' ? 'Завершено' : tx.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="ac-btn ac-btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={loadTransactions}>
              <i className="fas fa-redo-alt" /> Обновить
            </button>
          </BillingCard>

          <BillingCard>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fas fa-ticket-alt" style={{ opacity: 0.7 }} /> Промокод
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <BillInput
                icon="fa-tag"
                placeholder="Код"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                style={{ flex: 1, minWidth: 140 }}
              />
              <button type="button" className="ac-btn ac-btn-primary" onClick={handleActivatePromo}>
                Активировать
              </button>
            </div>
            <p className="bill-field__hint" style={{ marginTop: 12 }}>
              Бонус зачислится на баланс после активации
            </p>
          </BillingCard>
        </div>
      </div>
    </div>
  );
}
