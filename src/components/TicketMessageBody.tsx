import { parseTicketMessageContent } from '../utils/ticketMessage';

type TicketMessageBodyProps = {
  content: string;
  className?: string;
};

export function TicketMessageBody({ content, className = '' }: TicketMessageBodyProps) {
  const { text, images } = parseTicketMessageContent(content);

  if (!text && images.length === 0) {
    return null;
  }

  return (
    <div className={`ticket-msg__body ${className}`.trim()}>
      {text ? (
        <div className="ticket-msg__text" style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      ) : null}
      {images.length > 0 ? (
        <div className="ticket-msg__images">
          {images.map((src, i) => (
            <a
              key={`${src}-${i}`}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="ticket-msg__image-link"
            >
              <img src={src} alt={`Вложение ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
