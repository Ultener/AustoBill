<div align="center">
  <img src="https://raw.githubusercontent.com/Ultener/AustoBill/refs/heads/main/main/icon/logo.png" alt="AustoBill Logo" width="120"/>
  <h1>AustoBill</h1>
  <p><strong>Open Source billing panel for Pterodactyl</strong></p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/>
    <img src="https://img.shields.io/badge/node-20.x-green" alt="Node"/>
    <img src="https://img.shields.io/badge/version-1.0.0--beta-orange" alt="Version"/>
  </p>
</div>

---

## Overview

AustoBill is a self-hosted billing panel for game hosting services built on Pterodactyl. It provides automatic server creation, multiple payment gateways, and full Proxmox VPS support.

### Supported Payment Gateways

- **YooMoney** — Russian e-wallet and card payments
- **Platega.io** — Payment aggregation service
- **2328.io** — Cryptocurrency payments
- Cash / manual — Discord-based manual confirmation

### Virtualization Support

- **Pterodactyl** — Game servers (Minecraft, Rust, etc.)
- **Proxmox VE** — VDS/VPS virtual machines

---

## Features

| Feature | Description |
|---|---|
| Discord OAuth2 Login | Authenticate via Discord |
| Automatic provisioning | Server created instantly after payment |
| Admin dashboard | Manage users, servers, tariffs, payments |
| Multi-currency | RUB, USD, crypto |
| SMTP email | Notifications, invoices, password reset |
| Proxmox integration | Create/manage VMs with a single click |
| Platega / YooMoney / Crypto | Three payment gateways out of the box |
| Encrypted passwords | AES encryption for Pterodactyl credentials |

---

## Requirements

- **OS:** Ubuntu 20.04 / 22.04 / 24.04 (Debian 11+ also works)
- **RAM:** 1 GB minimum
- **CPU:** 1 core
- **Disk:** 10 GB
- **Domain:** A domain pointing to your server (for SSL)
- **Node.js:** 20.x LTS (installed automatically)

---

## Quick Install

```bash
sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/Ultener/AustoBill/main/install.sh)"
```

Or clone and run manually:

```bash
git clone https://github.com/Ultener/AustoBill.git
cd luminarix-bill
sudo bash install.sh
```

The installer will:

1. Ask for your preferred language (English / Русский)
2. Present an interactive menu — choose **1. Install AustoBill**
3. Walk through a configuration wizard (domain, Pterodactyl, Discord, SMTP, payments)
4. Install all dependencies and build the frontend
5. Start the panel at `http://YOUR_SERVER_IP`

---

## Management Menu

Re-run the installer anytime:

```bash
sudo bash install.sh
```

```
╔════════════════════════════════════════╗
║  1. Install AustoBill                  ║
║  2. Update AustoBill                   ║
║  3. Uninstall AustoBill                ║
║  ──────────────────────────            ║
║  4. Setup SSL (Let's Encrypt)          ║
║  5. Create Backup                      ║
║  6. Restart Service                    ║
║  ──────────────────────────            ║
║  7. Show Status                        ║
║  8. Show Logs                          ║
║  9. Settings (.env editor)             ║
║  ──────────────────────────            ║
║  0. Exit                               ║
╚════════════════════════════════════════╝
```

### Useful Commands

```bash
systemctl status austobill          # Check service status
systemctl restart austobill         # Restart the panel
journalctl -u austobill -f          # Watch real-time logs
journalctl -u austobill -n 100      # Last 100 log lines
cd /opt/austobill && npm run build  # Rebuild frontend
```

---

## Manual Installation

If you prefer to set things up by hand:

### 1. Clone & enter

```bash
git clone https://github.com/Ultener/AustoBill.git /opt/austobill
cd /opt/austobill
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

### 3. Install dependencies & build

```bash
npm install
npm run build
```

### 4. Setup systemd

```bash
cp deploy/austobill.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now austobill
```

### 5. Setup Nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/austobill
ln -s /etc/nginx/sites-available/austobill /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

### 6. SSL (optional)

```bash
certbot --nginx -d bill.example.com
```

---

## Environment Variables

The `.env` file is created automatically by the installer. Key variables:

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default: 3000) |
| `FRONTEND_URL` | Public domain (e.g. `https://bill.example.com`) |
| `DISCORD_CLIENT_ID` | Discord OAuth2 application ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 application secret |
| `SMTP_HOST` | SMTP server for email |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP login |
| `SMTP_PASS` | SMTP password |
| `PTERO_URL` | Pterodactyl panel URL |
| `PTERO_ADMIN_KEY` | Pterodactyl Admin API key (`ptla_...`) |
| `PROXMOX_HOST` | Proxmox host URL |
| `PROXMOX_TOKEN_ID` | Proxmox API token ID |
| `PROXMOX_TOKEN_SECRET` | Proxmox API token secret |
| `YOOMONEY_WALLET` | YooMoney wallet number |
| `YOOMONEY_SECRET` | YooMoney notification secret |
| `PLATEGA_MERCHANT_ID` | Platega merchant ID |
| `PLATEGA_SECRET_KEY` | Platega secret key |
| `ENCRYPTION_KEY` | Key for password encryption (auto-generated) |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |

Use the **Settings** menu (`sudo bash install.sh` → option 9) to edit any of these interactively.

---

## Update

```bash
sudo bash install.sh
# Choose option 2. Update AustoBill
```

The update process:

- Creates a full backup of `/opt/austobill`
- Pulls the latest code from GitHub
- Preserves your `.env` and database
- Rebuilds the frontend
- Restarts the service

---

## Uninstall

```bash
sudo bash install.sh
# Choose option 3. Uninstall AustoBill
```

This removes:

- All files in `/opt/austobill`
- SQLite database
- Nginx site configuration
- Systemd service

---

## Project Structure

```
/opt/austobill/
├── server.js              # Main server entry
├── .env                   # Environment configuration
├── install.sh             # Interactive installer & manager
├── deploy/
│   ├── luminarix.service  # Systemd unit file
│   └── nginx.conf         # Nginx reverse proxy config
├── src/
│   └── ...                # Application source
├── dist/                  # Built frontend (generated)
└── icon/
    └── logo.png           # Panel logo
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Links

- **Website:** [https://austocloud.fun](https://austocloud.fun)
- **Documentation:** [https://docs.austocloud.fun](https://docs.austocloud.fun)
- **GitHub:** [https://github.com/Ultener/AustoBill](https://github.com/Ultener/AustoBill)
