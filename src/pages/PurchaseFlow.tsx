import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import PurchaseSuccessOverlay from '../components/billing/PurchaseSuccessOverlay';
import { Tariff, GAME_CORES, CODING_CORES, plansApi, serversApi, pteroApi, promoApi, ApiError } from '../store';
import { validateServerNameClient } from '../utils/security';
import {
  PTERO_LOCATIONS,
  PteroLocation,
  VPS_LOCATION,
  getPteroLocationLabel,
  getFirstAvailablePteroNodeId,
} from '../lib/locations';

const STEPS = ['Основное', 'Тип', 'Софт / ОС', 'Тариф', 'Оплата'];

function formatProvisionError(err: unknown): { message: string; errorId?: string; stage?: string } {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      errorId: err.errorId,
      stage: err.stage,
    };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: 'Неизвестная ошибка при создании сервера' };
}

export default function PurchasePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [serverName, setServerName] = useState('');
  const [months, setMonths] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState(getFirstAvailablePteroNodeId());
  const [pteroLocations, setPteroLocations] = useState<PteroLocation[]>(PTERO_LOCATIONS);
  const [serverType, setServerType] = useState<'game' | 'coding' | 'vps'>('game');
  const [selectedCore, setSelectedCore] = useState('');
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [paying, setPaying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errorId, setErrorId] = useState('');
  const [provisionStatus, setProvisionStatus] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [oncePurchasedTariffs, setOncePurchasedTariffs] = useState<string[]>([]);

  // Состояния для VDS
  const [osTemplates, setOsTemplates] = useState<{ name: string; text: string }[]>([]);
  const [selectedOs, setSelectedOs] = useState('');
  const [loadingOs, setLoadingOs] = useState(false);

  const basePrice = selectedTariff ? selectedTariff.price * months : 0;
  const totalPrice = Math.max(0, basePrice - promoDiscount);

  // Адаптивность
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Вспомогательная функция для красивого отображения имени ОС
  const getOsDisplayName = (osName: string) => {
    // Сначала ищем в загруженном списке
    const found = osTemplates.find(t => t.name === osName);
    if (found && found.text) {
      // Делаем название короче, оставляя только дистрибутив и версию
      let short = found.text;
      if (short.includes('Standard')) short = short.replace('Standard', '').trim();
      if (short.includes('official')) short = short.replace('official', '').trim();
      if (short.includes('(')) short = short.split('(')[0].trim();
      return short;
    }
    // Если не нашли – парсим имя файла
    const match = osName.match(/\/([^/]+)\.tar\./);
    if (match) {
      let name = match[1].replace(/-standard.*/, '').replace(/_/g, ' ');
      name = name.replace(/ubuntu-(\d+\.\d+)/i, 'Ubuntu $1')
                 .replace(/debian-(\d+)/i, 'Debian $1')
                 .replace(/almalinux-(\d+)/i, 'AlmaLinux $1')
                 .replace(/centos-(\d+)/i, 'CentOS $1')
                 .replace(/rockylinux-(\d+)/i, 'Rocky Linux $1');
      return name;
    }
    return osName;
  };

  // Загрузка тарифов и списка купленных одноразовых тарифов
  useEffect(() => {
    const loadData = async () => {
      try {
        const [plans, purchasedRes] = await Promise.all([
          plansApi.list(),
          fetch('/api/user/once-purchased', {
            headers: { Authorization: `Bearer ${localStorage.getItem('lmx_token')}` }
          }).then(res => res.json()).catch(() => ({ tariffIds: [] }))
        ]);
        setTariffs(plans);
        setOncePurchasedTariffs(purchasedRes.tariffIds || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    pteroApi.purchaseLocations()
      .then((locations) => {
        if (!Array.isArray(locations) || locations.length === 0) return;
        setPteroLocations(locations);
        const available = locations.find(loc => !loc.overloaded);
        if (available) setSelectedNodeId(available.nodeId as typeof selectedNodeId);
      })
      .catch(() => {});
  }, []);

  // Загрузка шаблонов ОС для VDS
  useEffect(() => {
    if (serverType === 'vps' && step === 2 && osTemplates.length === 0 && !loadingOs) {
      loadOsTemplates();
    }
  }, [serverType, step]);

  const loadOsTemplates = async () => {
    setLoadingOs(true);
    try {
      const response = await fetch('/api/proxmox/templates', {
        headers: { Authorization: `Bearer ${localStorage.getItem('lmx_token')}` }
      });
      if (!response.ok) throw new Error('Failed to load OS templates');
      const data = await response.json();
      setOsTemplates(data);
      if (data.length > 0) setSelectedOs(data[0].name);
    } catch (error) {
      console.error('Failed to load OS templates:', error);
      setError('Не удалось загрузить список операционных систем. Обратитесь в поддержку.');
    } finally {
      setLoadingOs(false);
    }
  };

  const isTariffAvailable = (tariff: Tariff) => {
    if (!tariff.once_per_account) return true;
    return !oncePurchasedTariffs.includes(tariff.id);
  };

  const isTariffCompatibleWithNode = (tariff: Tariff, nodeId: number) => {
    if (tariff.node_id === null || tariff.node_id === undefined) return true;
    return tariff.node_id === nodeId;
  };

  const getFilteredTariffs = () => {
    if (serverType === 'vps') {
      return tariffs.filter(t => t.type === 'vps');
    }
    return tariffs.filter(t => {
      if (t.type !== serverType) return false;
      return isTariffCompatibleWithNode(t, selectedNodeId);
    });
  };

  const handleTariffSelect = (tariff: Tariff) => {
    if (isTariffAvailable(tariff)) {
      setSelectedTariff(tariff);
    }
  };

  const handleServerTypeChange = (type: 'game' | 'coding' | 'vps') => {
    setServerType(type);
    setSelectedCore('');
    setSelectedOs('');
    setSelectedTariff(null);
  };

  const selectedLocationLabel =
    serverType === 'vps' ? VPS_LOCATION.name : getPteroLocationLabel(selectedNodeId);

  const canNext = () => {
    if (step === 0) return !validateServerNameClient(serverName);
    if (step === 1) return true;
    if (step === 2) {
      if (serverType === 'vps') {
        return !!selectedOs;
      } else {
        return !!selectedCore;
      }
    }
    if (step === 3) return !!selectedTariff && isTariffAvailable(selectedTariff);
    return true;
  };

  const next = () => {
    setError('');
    if (canNext()) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => {
    setError('');
    setStep(s => Math.max(s - 1, 0));
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedTariff) return;
    try {
      const res = await promoApi.validate(promoCode.trim(), basePrice, 'purchase');
      if (res.type === 'balance') {
        setError('Этот промокод начисляет баланс — активируйте его в разделе «Пополнение»');
        return;
      }
      setPromoDiscount(res.discount);
      setPromoApplied(true);
      setAppliedPromoCode(promoCode.trim().toUpperCase());
      setError('');
    } catch (e) {
      setPromoApplied(false);
      setPromoDiscount(0);
      setAppliedPromoCode('');
      setError(e instanceof Error ? e.message : 'Неверный промокод');
    }
  };

  const handlePay = async () => {
    if (!user || !selectedTariff) return;
    const nameErr = validateServerNameClient(serverName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (!isTariffAvailable(selectedTariff)) {
      setError('Этот тариф уже был приобретён ранее.');
      return;
    }
    if (totalPrice > 0 && (user.balance ?? 0) < totalPrice) {
      setError('Недостаточно средств. Пополните баланс.');
      return;
    }
    if (serverType !== 'vps') {
      const selectedLocation = pteroLocations.find(loc => loc.nodeId === selectedNodeId);
      if (selectedLocation?.overloaded) {
        setError(selectedLocation.overloadedMessage || 'Выбранная локация временно недоступна для заказа.');
        return;
      }
    }
    setPaying(true);
    setError('');
    setErrorId('');
    setProvisionStatus('Проверка системы...');

    try {
      setProvisionStatus(
        serverType === 'vps'
          ? 'Подготовка VDS и проверка Proxmox...'
          : 'Проверка ноды и подготовка Pterodactyl...'
      );
      
      let coreName = '';
      if (serverType === 'game') {
        coreName = GAME_CORES.find(c => c.id === selectedCore)?.name || selectedCore;
      } else if (serverType === 'coding') {
        coreName = CODING_CORES.find(c => c.id === selectedCore)?.name || selectedCore;
      }

      const actualNodeId = serverType === 'vps' ? VPS_LOCATION.nodeId : selectedNodeId;

      const provisionPayload: Record<string, unknown> = {
        email: user.email,
        username: user.username,
        serverName,
        ram: selectedTariff.ram,
        disk: selectedTariff.disk,
        cpu: selectedTariff.cores,
        coreName,
        serverType,
        nodeId: actualNodeId,
        tariffId: selectedTariff.id,
        months,
      };
      if (appliedPromoCode) provisionPayload.promoCode = appliedPromoCode;

      if (serverType === 'vps') {
        provisionPayload.osTemplate = selectedOs;
      }

      setProvisionStatus(
        serverType === 'vps'
          ? 'Создание контейнера и настройка сети...'
          : 'Создание сервера на панели...'
      );

      const result = await pteroApi.provision(provisionPayload);

      if (!result.success || !result.server) {
        throw new Error(result.error || 'Ошибка создания сервера');
      }

      setProvisionStatus('Сохранение в базе данных...');
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const serverPayload: any = {
        name: serverName,
        tariffId: selectedTariff.id,
        tariffName: selectedTariff.name,
        tariffTier: selectedTariff.tier,
        coreName: coreName,
        ram: selectedTariff.ram,
        cores: selectedTariff.cores,
        disk: selectedTariff.disk,
        price: selectedTariff.price,
        months,
        expiresAt: expiresAt.toISOString(),
        ip: result.server.ip,
        port: result.server.port,
        node: actualNodeId,
        pterodactylServerId: result.server.id,
        pterodactylIdentifier: result.server.identifier,
        pterodactylUuid: result.server.uuid,
        type: serverType,
      };

      if (serverType === 'vps' && selectedOs) {
        serverPayload.os_template = selectedOs;
      }

      const response = await serversApi.create(serverPayload);
      await refreshUser();

      if (selectedTariff.once_per_account) {
        setOncePurchasedTariffs(prev => [...prev, selectedTariff.id]);
      }

      setPaying(false);
      setShowSuccess(true);
      setTimeout(() => navigate(`/dashboard/server/${response.server.id}`), 3000);
    } catch (err) {
      const { message, errorId: ref, stage } = formatProvisionError(err);
      console.error('[PurchaseFlow] provision failed:', { err, stage, errorId: ref });
      setError(message);
      setErrorId(ref || '');
      if (err instanceof ApiError && err.refunded) {
        refreshUser().catch(() => {});
      }
      setPaying(false);
      setProvisionStatus('');
    }
  };

  if (showSuccess) {
    return <PurchaseSuccessOverlay />;
  }

  const filteredTariffs = getFilteredTariffs();

  const renderSoftwareStep = () => {
    if (serverType === 'vps') {
      if (loadingOs) {
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--border-light)' }} />
            <p style={{ marginTop: 16, color: 'var(--text-dim)' }}>Загрузка списка операционных систем...</p>
          </div>
        );
      }
      if (osTemplates.length === 0) {
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="fas fa-box-open" style={{ fontSize: 48, opacity: 0.3, marginBottom: 16, color: '#fff' }} />
            <p style={{ color: 'var(--text-dim)' }}>Нет доступных шаблонов ОС. Обратитесь в поддержку.</p>
          </div>
        );
      }
      return (
        <div className="bill-form-panel">
          <h3 className="bill-form-panel__title">Выбор операционной системы</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {osTemplates.map(template => (
              <div
                key={template.name}
                onClick={() => setSelectedOs(template.name)}
                style={{
                  padding: isMobile ? '16px 12px' : '20px 16px',
                  borderRadius: 20,
                  border: `2px solid ${selectedOs === template.name ? 'var(--border-light)' : 'rgba(255,255,255,0.1)'}`,
                  background: selectedOs === template.name ? 'rgba(255,255,255,0.06)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <i className="fab fa-linux" style={{ fontSize: 32, color: 'var(--border-light)', marginBottom: 12, display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#fff' }}>{template.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{template.name.split('/').pop()}</div>
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      return (
        <div className="bill-form-panel">
          <h3 className="bill-form-panel__title">
            {serverType === 'game' ? 'Выбор игрового ядра' : 'Выбор языкового окружения'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 16 }}>
            {(serverType === 'game' ? GAME_CORES : CODING_CORES).map(core => (
              <div
                key={core.id}
                onClick={() => setSelectedCore(core.id)}
                style={{
                  padding: isMobile ? '16px 8px' : '20px 12px',
                  borderRadius: 20,
                  border: `2px solid ${selectedCore === core.id ? (serverType === 'game' ? 'var(--border-light)' : '#fff') : 'rgba(255,255,255,0.1)'}`,
                  background: selectedCore === core.id ? (serverType === 'game' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.06)') : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}><i className={`fas ${core.icon}`} style={{ color: serverType === 'game' ? 'var(--border-light)' : '#fff' }} /></div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: '#fff' }}>{core.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{core.desc}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  const renderLocationStep = () => {
    if (serverType === 'vps') {
      return (
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Локация</label>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: '2px solid var(--border-light)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            <i className="fas fa-location-dot" style={{ marginRight: 8 }} />
            {VPS_LOCATION.name}
          </div>
        </div>
      );
    }

    return (
      <div className="form-group">
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Локация</label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {pteroLocations.map(loc => {
            const disabled = !!loc.overloaded;
            const selected = !disabled && selectedNodeId === loc.nodeId;
            return (
            <button
              key={loc.nodeId}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setSelectedNodeId(loc.nodeId);
                setSelectedTariff(null);
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                border: `2px solid ${selected ? 'var(--border-light)' : disabled ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`,
                background: selected ? 'rgba(255,255,255,0.08)' : disabled ? 'rgba(239,68,68,0.06)' : 'transparent',
                color: disabled ? 'var(--text-dim)' : selected ? '#fff' : 'var(--text-dim)',
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: disabled ? 0.85 : 1,
              }}
            >
              <i className={`fas ${disabled ? 'fa-triangle-exclamation' : 'fa-location-dot'}`} style={{ marginRight: 8, color: disabled ? '#f87171' : undefined }} />
              {loc.label}
              <div style={{ fontSize: 11, color: disabled ? '#f87171' : 'var(--text-dim)', marginTop: 4, fontWeight: 500 }}>
                {disabled
                  ? (loc.overloadedMessage || 'Сервис переполнен')
                  : `Pterodactyl · нода ${loc.nodeId}`}
              </div>
            </button>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedBorder = 'var(--border-light)';
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-dim)',
    borderRadius: 16,
    padding: isMobile ? 20 : 28,
  };
  const pickStyle = (selected: boolean): React.CSSProperties => ({
    border: `2px solid ${selected ? selectedBorder : 'var(--border-dim)'}`,
    background: selected ? 'rgba(255,255,255,0.06)' : 'transparent',
  });

  return (
    <div className="bill-page bill-page--fill">
      <div className="bill-page__head">
      <h1 className="bill-page-title" style={{ marginBottom: 4 }}>Новый сервер</h1>
      <p className="bill-page-sub" style={{ marginBottom: 20 }}>5 шагов до запуска</p>

      <div className="steps-bar ac-card" style={{ padding: 4, marginBottom: 0 }}>
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={'bill-tab' + (i === step ? ' bill-tab--active' : '')}
            style={{
              flex: isMobile ? '1 1 auto' : 1,
              textAlign: 'center',
              fontSize: isMobile ? 12 : 14,
              whiteSpace: 'nowrap',
              borderRadius: 10,
            }}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 16px',
              borderRadius: 16,
              marginBottom: 20,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <div>
              <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} /> {error}
            </div>
            {errorId && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(248,113,113,0.85)' }}>
                Сообщите этот код в поддержку: <strong>{errorId}</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      </div>

      <motion.div className="bill-page__body">
      <div className="bill-purchase-layout" style={isMobile ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="bill-purchase-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="bill-purchase-main__step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <div className="bill-form-panel">
                  <h3 className="bill-form-panel__title">Основное</h3>
                  <div className="bill-field" style={{ marginBottom: 20 }}>
                    <label className="bill-field__label">Название сервера</label>
                    <input
                      className="bill-input"
                      style={{ paddingLeft: 16 }}
                      placeholder="MyServer"
                      value={serverName}
                      onChange={e => setServerName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    />
                    {validateServerNameClient(serverName) && (
                      <p className="bill-field__hint" style={{ color: '#f87171', marginTop: 8 }}>
                        {validateServerNameClient(serverName)}
                      </p>
                    )}
                    <p className="bill-field__hint" style={{ marginTop: 6 }}>
                      Только латинские буквы, цифры и дефис (3–32 символа)
                    </p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Срок</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      {[1, 3, 6, 12].map(m => (
                        <button
                          key={m}
                          onClick={() => setMonths(m)}
                          style={{
                            padding: '10px 0',
                            borderRadius: 14,
                            border: `2px solid ${months === m ? 'var(--border-light)' : 'rgba(255,255,255,0.1)'}`,
                            background: months === m ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: months === m ? '#fff' : 'var(--text-dim)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {m} мес.
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="bill-form-panel">
                  <h3 className="bill-form-panel__title">Тип сервера</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>
                    <div
                      onClick={() => handleServerTypeChange('game')}
                      style={{
                        padding: isMobile ? '16px' : '24px',
                        borderRadius: 24,
                        border: `2px solid ${serverType === 'game' ? 'var(--border-light)' : 'rgba(255,255,255,0.1)'}`,
                        background: serverType === 'game' ? 'rgba(255,255,255,0.06)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <i className="fas fa-gamepad" style={{ fontSize: isMobile ? 36 : 48, color: 'var(--border-light)', marginBottom: 16 }} />
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Игровой сервер</div>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Minecraft, Rust, CS и другие</div>
                    </div>
                    <div
                      onClick={() => handleServerTypeChange('coding')}
                      style={{
                        padding: isMobile ? '16px' : '24px',
                        borderRadius: 24,
                        border: `2px solid ${serverType === 'coding' ? '#fff' : 'rgba(255,255,255,0.1)'}`,
                        background: serverType === 'coding' ? 'rgba(255,255,255,0.06)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <i className="fas fa-code" style={{ fontSize: isMobile ? 36 : 48, color: '#fff', marginBottom: 16 }} />
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Кодинг сервер</div>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Node.js, Python, Go, PHP</div>
                    </div>
                    <div
                      onClick={() => handleServerTypeChange('vps')}
                      style={{
                        padding: isMobile ? '16px' : '24px',
                        borderRadius: 24,
                        border: `2px solid ${serverType === 'vps' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                        background: serverType === 'vps' ? 'rgba(16,185,129,0.1)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <i className="fas fa-cloud" style={{ fontSize: isMobile ? 36 : 48, color: '#10b981', marginBottom: 16 }} />
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>VDS сервер</div>
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Виртуальный выделенный сервер (LXC)</div>
                    </div>
                  </div>
                  {renderLocationStep()}
                </div>
              )}

              {step === 2 && renderSoftwareStep()}

              {step === 3 && (
                <div className="bill-form-panel">
                  <h3 className="bill-form-panel__title">Выбор тарифа</h3>
                  {filteredTariffs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <i className="fas fa-box-open" style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }} />
                      <p style={{ color: 'var(--text-dim)' }}>Нет доступных тарифов для выбранного типа сервера и локации.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
                      {filteredTariffs.map(t => {
                        const available = isTariffAvailable(t);
                        return (
                          <div
                            key={t.id}
                            onClick={() => handleTariffSelect(t)}
                            style={{
                              padding: '20px',
                              borderRadius: 20,
                              border: `2px solid ${selectedTariff?.id === t.id ? (serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981') : 'rgba(255,255,255,0.1)'}`,
                              background: selectedTariff?.id === t.id ? (serverType === 'game' ? 'rgba(255,255,255,0.06)' : serverType === 'coding' ? 'rgba(255,255,255,0.06)' : 'rgba(16,185,129,0.1)') : 'transparent',
                              cursor: available ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s',
                              opacity: available ? 1 : 0.5,
                              position: 'relative',
                            }}
                          >
                            {!available && (
                              <div style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                background: '#ef4444',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: 20,
                                fontSize: 10,
                                fontWeight: 'bold',
                              }}>
                                Лимит превышен
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>{t.tier} {t.name}</span>
                              {t.popular && (
                                <span style={{ background: serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#fff' }}>POPULAR</span>
                              )}
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981', marginBottom: 12 }}>{t.price}₽/мес</div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--text-dim)' }}>
                              {t.features.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 24 : 32, textAlign: 'center' }}>
                  <i className="fas fa-credit-card" style={{ fontSize: 48, color: serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981', marginBottom: 16 }} />
                  <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#fff' }}>Подтверждение оплаты</h3>
                  <p style={{ marginBottom: 16, color: 'var(--text-gray)' }}>
                    Со счёта будет списано <strong style={{ color: serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981' }}>{totalPrice}₽</strong>
                  </p>
                  <div style={{ marginBottom: 16, fontSize: 15 }}>
                    Баланс: <span style={{ fontWeight: 700, color: (user?.balance ?? 0) >= totalPrice ? '#34d399' : '#ef4444' }}>{user?.balance?.toLocaleString()}₽</span>
                  </div>

                  {paying && provisionStatus && (
                    <div style={{ marginBottom: 24, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 16, fontSize: 13 }}>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> {provisionStatus}
                    </div>
                  )}

                  {/* Кнопка оплаты показывается только если хватает средств */}
                  {(user?.balance ?? 0) >= totalPrice ? (
                    <button
                      type="button"
                      className="ac-btn ac-btn-primary"
                      onClick={handlePay}
                      disabled={paying || (selectedTariff && !isTariffAvailable(selectedTariff))}
                      style={{
                        width: '100%',
                        padding: '14px',
                        opacity: (paying || (selectedTariff && !isTariffAvailable(selectedTariff))) ? 0.7 : 1,
                        cursor: (paying || (selectedTariff && !isTariffAvailable(selectedTariff))) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {paying ? 'Создаём сервер...' : 
                       (selectedTariff && !isTariffAvailable(selectedTariff)) ? 'Превышен лимит тарифа' : `Оплатить ${totalPrice}₽`}
                    </button>
                  ) : (
                    <div style={{ marginTop: 16 }}>
                      <div style={{
                        color: '#ef4444',
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 16,
                        padding: '12px',
                        background: 'rgba(239,68,68,0.1)',
                        borderRadius: 16,
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
                        Недостаточно средств
                      </div>
                      <button
                        type="button"
                        className="ac-btn ac-btn-primary"
                        onClick={() => navigate('/dashboard/topup')}
                        style={{
                          width: '100%',
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <i className="fas fa-wallet" /> Пополнить баланс
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Правая колонка — заказ (на мобильных снизу) */}
        <div className="ac-card bill-purchase-sidebar" style={{ padding: isMobile ? 20 : 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff' }}>Ваш заказ</h3>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Тип</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{serverType === 'game' ? 'Игровой' : serverType === 'coding' ? 'Кодинг' : 'VDS'}</span>
            </div>
            {serverType === 'vps' && selectedOs && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: 'var(--text-dim)' }}>ОС</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{getOsDisplayName(selectedOs)}</span>
              </div>
            )}
            {(serverType === 'game' || serverType === 'coding') && selectedCore && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: 'var(--text-dim)' }}>Ядро</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>
                  {(serverType === 'game' ? GAME_CORES : CODING_CORES).find(c => c.id === selectedCore)?.name || selectedCore}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Тариф</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{selectedTariff ? `${selectedTariff.tier} ${selectedTariff.name}` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-dim)' }}>Период</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{months} мес.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
              <span style={{ color: 'var(--text-dim)' }}>Локация</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>
                {selectedLocationLabel}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 8, fontWeight: 500 }}>Промокод</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Код"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 12px', color: '#fff', minWidth: isMobile ? '100%' : 0 }}
              />
              <button
                onClick={handleApplyPromo}
                style={{ padding: '0 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, cursor: 'pointer', color: '#fff', whiteSpace: 'nowrap', width: isMobile ? '100%' : undefined }}
              >
                Применить
              </button>
            </div>
            {promoApplied && <p style={{ fontSize: 11, color: '#34d399', marginTop: 6 }}>Промокод активирован! +100 баллов</p>}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
              <span>Итого</span>
              <span style={{ color: serverType === 'game' ? 'var(--border-light)' : serverType === 'coding' ? '#fff' : '#10b981' }}>{totalPrice}₽</span>
            </div>
          </div>
        </div>
      </div>
      </motion.div>

      <div className="bill-page__foot" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          className="btn btn-ghost"
          onClick={prev}
          disabled={step === 0}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            color: step === 0 ? 'var(--text-dim)' : '#fff',
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }} /> Назад
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={next}
            disabled={!canNext()}
            style={{
              padding: '12px 32px',
              cursor: canNext() ? 'pointer' : 'not-allowed',
              opacity: canNext() ? 1 : 0.5,
            }}
          >
            Далее <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} />
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}