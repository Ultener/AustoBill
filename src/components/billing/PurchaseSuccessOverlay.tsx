import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'AustoCloud';

export default function PurchaseSuccessOverlay() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, []);

  const statusLines = [
    'Платёж подтверждён',
    'Выделяем ресурсы на ноде',
    'Настраиваем панель управления',
    'Почти готово…',
  ];

  return (
    <div className="purchase-success" role="dialog" aria-label="Успешная покупка">
      <motion.div
        className="purchase-success__grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />

      <motion.div
        className="purchase-success__ring purchase-success__ring--outer"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="purchase-success__ring purchase-success__ring--inner"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        className="purchase-success__card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="purchase-success__badge">
          <motion.div
            className="purchase-success__check"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.35 }}
          >
            <i className="fas fa-check" />
          </motion.div>
        </div>

        <p className="purchase-success__brand">{APP_NAME}</p>
        <h2 className="purchase-success__title">Сервер в очереди на создание</h2>
        <p className="purchase-success__sub">
          Оплата прошла успешно. Сейчас поднимаем инфраструктуру — это займёт пару минут.
        </p>

        <div className="purchase-success__stats">
          {['99.9% uptime', 'NVMe', 'DDoS shield', '24/7'].map((s, i) => (
            <span key={s} style={{ animationDelay: `${i * 0.08}s` }}>
              {s}
            </span>
          ))}
        </div>

        <div className="purchase-success__status">
          <span className="purchase-success__pulse" />
          {statusLines[tick % statusLines.length]}
        </div>

        <div className="purchase-success__bar">
          <motion.div
            className="purchase-success__bar-fill"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <p className="purchase-success__redirect">Перенаправление в панель…</p>
      </motion.div>
    </div>
  );
}
