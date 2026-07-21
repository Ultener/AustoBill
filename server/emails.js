/**
 * Единые HTML-шаблоны писем (чёрно-белый стиль биллинга).
 */

const BASE_STYLE = `
  body { margin: 0; padding: 0; background: #f4f4f5; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0a0a0a; }
  .wrap { max-width: 560px; margin: 24px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; overflow: hidden; }
  .head { padding: 28px 32px 20px; border-bottom: 1px solid #e4e4e7; }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #71717a; margin: 0 0 8px; }
  .head h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #09090b; }
  .head p { margin: 10px 0 0; font-size: 14px; color: #52525b; line-height: 1.5; }
  .body { padding: 28px 32px; font-size: 15px; line-height: 1.65; color: #3f3f46; }
  .body p { margin: 0 0 16px; }
  .box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 14px; padding: 20px; margin: 20px 0; }
  .box-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 6px; }
  .box-value { font-size: 18px; font-weight: 700; color: #09090b; word-break: break-all; }
  .code { display: block; text-align: center; font-size: 36px; font-weight: 800; letter-spacing: 0.35em; padding: 20px; background: #09090b; color: #ffffff; border-radius: 14px; margin: 24px 0; }
  .btn { display: inline-block; background: #09090b; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 999px; margin-top: 8px; }
  .foot { padding: 20px 32px 28px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center; }
  .foot a { color: #09090b; }
  .row { margin-bottom: 14px; }
  .row:last-child { margin-bottom: 0; }
`;

function layout(appName, { title, subtitle, bodyHtml, footerExtra = '' }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${BASE_STYLE}</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <p class="brand">${appName}</p>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="foot">
      <p>© ${new Date().getFullYear()} ${appName}</p>
      ${footerExtra}
    </div>
  </div>
</body>
</html>`;
}

export function buildVerificationEmail(appName, code) {
  return {
    subject: `Подтверждение регистрации — ${appName}`,
    html: layout(appName, {
      title: 'Подтвердите email',
      subtitle: 'Остался один шаг до доступа в личный кабинет',
      bodyHtml: `
        <p>Здравствуйте! Введите код ниже на сайте, чтобы завершить регистрацию.</p>
        <span class="code">${code}</span>
        <p style="font-size:13px;color:#71717a;">Код действует 15 минут. Если вы не регистрировались — проигнорируйте письмо.</p>
      `,
    }),
  };
}

export function buildResetPasswordEmail(appName, code) {
  return {
    subject: `Сброс пароля — ${appName}`,
    html: layout(appName, {
      title: 'Сброс пароля',
      subtitle: 'Запрос на смену пароля для вашего аккаунта',
      bodyHtml: `
        <p>Используйте код для установки нового пароля:</p>
        <span class="code">${code}</span>
        <p style="font-size:13px;color:#71717a;">Код действует 15 минут. Если запрос не ваш — ничего делать не нужно.</p>
      `,
    }),
  };
}

export function buildPterodactylCredentialsEmail(appName, email, password, panelUrl) {
  return {
    subject: `Доступ к игровой панели — ${appName}`,
    html: layout(appName, {
      title: 'Игровой сервер готов',
      subtitle: 'Учётная запись Pterodactyl создана',
      bodyHtml: `
        <p>Пароль панели совпадает с паролем вашего аккаунта на сайте.</p>
        <div class="box">
          <div class="row"><div class="box-label">Логин</div><div class="box-value">${email}</div></div>
          <div class="row"><div class="box-label">Пароль</div><div class="box-value">${password}</div></div>
        </div>
        <p style="text-align:center;"><a href="${panelUrl}" class="btn">Открыть панель</a></p>
      `,
    }),
  };
}

export function buildGameServerReadyEmail(appName, { username, serverName, tariffName, panelUrl, email, password }) {
  return {
    subject: `Сервер «${serverName}» активирован — ${appName}`,
    html: layout(appName, {
      title: 'Игровой тариф активирован',
      subtitle: `Здравствуйте, ${username || 'клиент'}!`,
      bodyHtml: `
        <p>Сервер <strong>${serverName}</strong> успешно создан. Тариф: <strong>${tariffName}</strong>.</p>
        <div class="box">
          <div class="row"><div class="box-label">Панель Pterodactyl</div><div class="box-value">${email}</div></div>
          <div class="row"><div class="box-label">Пароль</div><div class="box-value">${password}</div></div>
        </div>
        <p style="text-align:center;"><a href="${panelUrl}" class="btn">Управление сервером</a></p>
      `,
    }),
  };
}

export function buildVdsReadyEmail(appName, { username, serverName, ip, password, proxmoxUrl, proxmoxUser }) {
  return {
    subject: `VDS «${serverName}» готов — ${appName}`,
    html: layout(appName, {
      title: 'VDS активирован',
      subtitle: `Здравствуйте, ${username || 'клиент'}!`,
      bodyHtml: `
        <p>Контейнер <strong>${serverName}</strong> запущен.</p>
        <div class="box">
          <div class="row"><div class="box-label">IP</div><div class="box-value">${ip || 'назначается DHCP'}</div></div>
          <div class="row"><div class="box-label">Пароль root</div><div class="box-value">${password}</div></div>
          <div class="row"><div class="box-label">Proxmox логин</div><div class="box-value">${proxmoxUser}</div></div>
          <div class="row"><div class="box-label">Proxmox пароль</div><div class="box-value">${password}</div></div>
        </div>
        <p style="text-align:center;"><a href="${proxmoxUrl}" class="btn">Панель Proxmox</a></p>
        <p style="font-size:13px;color:#71717a;">SSH: <strong>root@${ip || 'ваш-ip'}</strong></p>
      `,
    }),
  };
}

export function buildBanEmail(appName, { username, reason, byIp }) {
  const ipLine = byIp
    ? '<p><strong>Тип блокировки:</strong> аккаунт и IP-адрес последнего входа. С этого адреса войти нельзя.</p>'
    : '<p><strong>Тип блокировки:</strong> только аккаунт (IP не заблокирован).</p>';
  return {
    subject: `Аккаунт заблокирован — ${appName}`,
    html: layout(appName, {
      title: 'Аккаунт заблокирован',
      subtitle: username ? `Здравствуйте, ${username}!` : 'Здравствуйте!',
      bodyHtml: `
        <p>Ваш аккаунт на ${appName} был заблокирован администрацией.</p>
        <div class="box">
          <div class="box-label">Причина</div>
          <div class="box-value" style="font-size:15px;font-weight:600;">${reason}</div>
        </div>
        ${ipLine}
        <p>Если считаете блокировку ошибкой — ответьте на это письмо или создайте тикет в поддержке (если вход ещё доступен с другого устройства).</p>
      `,
    }),
  };
}

export function buildTicketReplyEmail(appName, { username, subject, excerpt, ticketsUrl }) {
  const safeExcerpt = String(excerpt || '').slice(0, 400);
  return {
    subject: `Ответ по тикету: ${subject} — ${appName}`,
    html: layout(appName, {
      title: 'Новый ответ в поддержке',
      subtitle: `Здравствуйте, ${username || 'клиент'}!`,
      bodyHtml: `
        <p>По обращению <strong>«${subject}»</strong> поступил ответ от службы поддержки.</p>
        <div class="box" style="font-size:14px;font-style:italic;">${safeExcerpt}</div>
        <p style="text-align:center;"><a href="${ticketsUrl}" class="btn">Открыть тикет</a></p>
      `,
    }),
  };
}
