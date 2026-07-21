import { TicketMessage } from '../store';
import { TicketMessageBody } from './TicketMessageBody';
import { isTicketAutoReply } from '../utils/ticketMessage';

type TicketMessageCardProps = {
  message: TicketMessage;
  padding?: string;
};

export function TicketMessageCard({ message: m, padding = '18px' }: TicketMessageCardProps) {
  const auto = isTicketAutoReply(m.authorId);
  const staff = m.isStaff && !auto;

  return (
    <div
      className={auto ? 'ticket-msg--auto' : undefined}
      style={{
        padding,
        borderRadius: 24,
        background: auto
          ? 'rgba(255, 255, 255, 0.04)'
          : staff
            ? 'rgba(59, 130, 246, 0.08)'
            : 'rgba(255, 255, 255, 0.02)',
        borderLeft: `4px solid ${
          auto ? 'rgba(255, 255, 255, 0.35)' : staff ? '#ffffff' : 'rgba(255, 255, 255, 0.1)'
        }`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span
          className="ticket-msg__author"
          style={{ fontWeight: 700, color: auto ? 'var(--text-gray)' : staff ? '#ffffff' : '#fff' }}
        >
          {auto ? (
            <i className="fas fa-robot" style={{ marginRight: 6 }} aria-hidden />
          ) : staff ? (
            <i className="fas fa-shield-halved" style={{ marginRight: 6 }} aria-hidden />
          ) : null}
          {m.authorName}
          {auto ? (
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, opacity: 0.7 }}>автоответ</span>
          ) : null}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {new Date(m.createdAt).toLocaleString('ru-RU')}
        </span>
      </div>
      <TicketMessageBody content={m.content} />
    </div>
  );
}
