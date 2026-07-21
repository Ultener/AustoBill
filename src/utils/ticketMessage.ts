export const TICKET_AUTO_REPLY_AUTHOR_ID = 'system';

export function isTicketAutoReply(authorId: string): boolean {
  return authorId === TICKET_AUTO_REPLY_AUTHOR_ID;
}

const META_LINE =
  /^\[(Приоритет:|Тип услуги:|Сервер:|Прикреплено изображений:)/;

const MD_IMAGE = /!\[[^\]]*\]\(([^)]+)\)/g;

/** Убирает служебные строки и markdown-картинки, возвращает текст и URL вложений. */
export function parseTicketMessageContent(raw: string): { text: string; images: string[] } {
  const images: string[] = [];
  const textLines: string[] = [];

  for (const line of raw.split('\n')) {
    if (META_LINE.test(line.trim())) continue;

    let rest = line;
    MD_IMAGE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MD_IMAGE.exec(line)) !== null) {
      if (m[1]) images.push(m[1]);
    }
    rest = line.replace(MD_IMAGE, '').trim();
    if (rest) textLines.push(rest);
  }

  return { text: textLines.join('\n').trim(), images };
}

/** Только текст без метаданных и без картинок (для превью в списке). */
export function cleanTicketMessageText(raw: string): string {
  return parseTicketMessageContent(raw).text;
}

export function appendTicketImages(message: string, imageUrls: string[]): string {
  if (!imageUrls.length) return message;
  const block = imageUrls.map(url => `![скриншот](${url})`).join('\n');
  const base = message.trim();
  return base ? `${base}\n\n${block}` : block;
}
