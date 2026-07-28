#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AustoBill — Interactive Installer & Manager
# ═══════════════════════════════════════════════════════════════
# Usage: curl -sSL https://raw.githubusercontent.com/... | bash
#        sudo bash install.sh
# ═══════════════════════════════════════════════════════════════

# ── Colors ──
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'
C='\033[0;36m'; P='\033[0;35m'; W='\033[1;37m'; D='\033[2m'; N='\033[0m'
BOLD='\033[1m'

# ── Paths ──
DIR="/opt/luminarix"
ENV_FILE="$DIR/.env"
SERVICE="luminarix"
REPO_URL="https://github.com/Ultener/AustoBill.git"

# ── State ──
LANG=""

# ═══════════════════════════════════════════════════════════════
# STRINGS
# ═══════════════════════════════════════════════════════════════

# English
declare -A EN
EN[title]="AustoBill — Interactive Installer"
EN[version]="v1.0.0"
EN[lang_prompt]="Select language / Выберите язык"
EN[lang_en]="English"
EN[lang_ru]="Русский"
EN[root_err]="Please run as root: sudo bash install.sh"
EN[menu_title]="Main Menu"
EN[menu_install]="Install AustoBill"
EN[menu_update]="Update AustoBill"
EN[menu_uninstall]="Uninstall AustoBill"
EN[menu_ssl]="Setup SSL (Let's Encrypt)"
EN[menu_backup]="Create Backup"
EN[menu_restart]="Restart Service"
EN[menu_status]="Show Status"
EN[menu_logs]="Show Logs"
EN[menu_exit]="Exit"
EN[menu_installed]="Installed"
EN[menu_running]="Running"
EN[menu_not_installed]="Not Installed"
EN[menu_stopped]="Stopped"
EN[menu_choose]="Choose an option"
EN[menu_prompt]="Enter number"
EN[back]="Back to menu"
EN[enter]="Press Enter to continue..."
EN[yes]="yes"
EN[no]="no"
EN[confirm]="Are you sure?"
EN[proceed]="Continue?"
EN[skip]="Skip"
EN[done]="Done"
EN[fail]="Failed"
EN[cancelled]="Cancelled"

# Installation
EN[install_begin]="Starting AustoBill installation"
EN[install_step1]="Updating system packages"
EN[install_step2]="Installing dependencies (curl, wget, git, nginx, certbot)"
EN[install_step3]="Creating directory"
EN[install_step4]="Downloading repository"
EN[install_step5]="Installing Node.js 20.x LTS"
EN[install_step6]="Installing npm dependencies"
EN[install_step7]="Building frontend"
EN[install_step8]="Setting up systemd service"
EN[install_step9]="Configuring Nginx"
EN[install_step10]="Setting up firewall"
EN[install_done]="Installation complete!"
EN[install_already]="AustoBill is already installed at $DIR"
EN[install_update_first]="Use the update option instead"

# Config prompts
EN[cfg_domain]="Enter your domain (e.g., bill.example.com)"
EN[cfg_domain_help]="This will be used for Nginx and Let's Encrypt"
EN[cfg_ptero_url]="Enter your Pterodactyl panel URL"
EN[cfg_ptero_url_help]="e.g., https://panel.example.com"
EN[cfg_ptero_key]="Enter your Pterodactyl Admin API key"
EN[cfg_ptero_key_help]="Generate in Admin → Application API (ptla_...)"
EN[cfg_discord_id]="Enter Discord OAuth2 Client ID"
EN[cfg_discord_id_help]="Leave empty to skip Discord login"
EN[cfg_discord_secret]="Enter Discord OAuth2 Client Secret"
EN[cfg_discord_secret_help]="Leave empty to skip Discord login"
EN[cfg_smtp_host]="Enter SMTP host"
EN[cfg_smtp_host_help]="Leave empty to disable email (default: connect.smtp.bz)"
EN[cfg_smtp_port]="Enter SMTP port"
EN[cfg_smtp_user]="Enter SMTP username"
EN[cfg_smtp_pass]="Enter SMTP password"
EN[cfg_smtp_from]="Enter SMTP from address"
EN[cfg_admin_email]="Enter admin email address"
EN[cfg_admin_email_help]="Used for initial admin account creation"
EN[cfg_admin_pass]="Enter admin password"
EN[cfg_admin_pass_help]="Min 8 chars, letters and numbers"
EN[cfg_yoomoney_wallet]="Enter YooMoney wallet number"
EN[cfg_yoomoney_wallet_help]="Leave empty to disable YooMoney"
EN[cfg_yoomoney_secret]="Enter YooMoney notification secret"
EN[cfg_platega_merchant]="Enter Platega merchant ID"
EN[cfg_platega_merchant_help]="Leave empty to disable Platega"
EN[cfg_platega_secret]="Enter Platega secret key"
EN[cfg_proxmox_host]="Enter Proxmox host URL"
EN[cfg_proxmox_host_help]="Leave empty to disable Proxmox (e.g., https://proxmox:8006)"
EN[cfg_proxmox_token]="Enter Proxmox API token ID"
EN[cfg_proxmox_token_help]="Format: user@pam!tokenname"
EN[cfg_proxmox_secret]="Enter Proxmox API token secret"
EN[cfg_proxmox_node]="Enter Proxmox node name"
EN[cfg_encryption_key]="Generate encryption key automatically?"
EN[cfg_encryption_key_help]="Required for Pterodactyl password encryption"

# Uninstall
EN[uninstall_warn]="WARNING: This will remove AustoBill and ALL data"
EN[uninstall_warn2]="This includes:"
EN[uninstall_warn3]="- All files in $DIR"
EN[uninstall_warn4]="- Database (SQLite)"
EN[uninstall_warn5]="- Nginx config"
EN[uninstall_warn6]="- Systemd service"
EN[uninstall_step1]="Stopping service"
EN[uninstall_step2]="Removing Nginx config"
EN[uninstall_step3]="Removing service"
EN[uninstall_step4]="Removing files"
EN[uninstall_done]="AustoBill has been removed"

# Update
EN[update_step1]="Creating backup"
EN[update_step2]="Downloading updates"
EN[update_step3]="Updating files"
EN[update_step4]="Rebuilding frontend"
EN[update_step5]="Restarting service"
EN[update_done]="Update complete!"
EN[update_backup]="Backup saved to"

# SSL
EN[ssl_install]="Installing Let's Encrypt SSL"
EN[ssl_domain]="Enter your domain (e.g., bill.example.com)"
EN[ssl_check]="Make sure DNS A record points to this server"
EN[ssl_email]="Enter email for Let's Encrypt notifications"
EN[ssl_success]="SSL certificate installed!"
EN[ssl_auto]="Auto-renewal is set up automatically"

# Post-install
EN[post_url]="Website"
EN[post_dir]="Directory"
EN[post_admin]="Admin Login"
EN[post_email]="Email"
EN[post_pass]="Password"
EN[post_next]="Next Steps"
EN[post_next1]="Set up your domain DNS (A record)"
EN[post_next2]="Install SSL with Let's Encrypt"
EN[post_next3]="Configure Pterodactyl integration in admin panel"
EN[post_next4]="Add payment gateways in admin panel"
EN[post_commands]="Useful Commands"
EN[post_cmd_status]="Check service status"
EN[post_cmd_restart]="Restart service"
EN[post_cmd_logs]="View real-time logs"
EN[post_cmd_logs_n]="View last 100 log lines"
EN[post_cmd_rebuild]="Rebuild frontend after update"
EN[post_manage]="Re-run this script anytime: sudo bash install.sh"

# Settings
EN[menu_settings]="Settings"
EN[settings_title]="Configuration"
EN[settings_ptero]="Pterodactyl Settings"
EN[settings_discord]="Discord OAuth2 Settings"
EN[settings_smtp]="SMTP / Email Settings"
EN[settings_yoomoney]="YooMoney Settings"
EN[settings_platega]="Platega Settings"
EN[settings_proxmox]="Proxmox Settings"
EN[settings_admin]="Admin Credentials"
EN[settings_encryption]="Encryption Key"
EN[settings_domain]="Domain / Frontend URL"
EN[settings_back]="Back to Main Menu"
EN[settings_current]="Current value"
EN[settings_new]="Enter new value (or press Enter to keep current)"
EN[settings_updated]="Setting updated"
EN[settings_key_regenerated]="Encryption key regenerated successfully"

# reCAPTCHA
EN[cfg_recaptcha_ask]="Enable reCAPTCHA for login/register forms?"
EN[cfg_recaptcha_site_key]="Enter reCAPTCHA Site Key (v2)"
EN[cfg_recaptcha_site_key_help]="Get it from https://www.google.com/recaptcha/admin"
EN[cfg_recaptcha_secret_key]="Enter reCAPTCHA Secret Key"
EN[settings_recaptcha]="reCAPTCHA Settings"

# Russian
declare -A RU
RU[title]="AustoBill — Интерактивный установщик"
RU[version]="v1.0.0"
RU[lang_prompt]="Выберите язык / Select language"
RU[lang_en]="English"
RU[lang_ru]="Русский"
RU[root_err]="Запустите от root: sudo bash install.sh"
RU[menu_title]="Главное меню"
RU[menu_install]="Установить AustoBill"
RU[menu_update]="Обновить AustoBill"
RU[menu_uninstall]="Удалить AustoBill"
RU[menu_ssl]="Настроить SSL (Let's Encrypt)"
RU[menu_backup]="Создать бэкап"
RU[menu_restart]="Перезапустить сервис"
RU[menu_status]="Показать статус"
RU[menu_logs]="Показать логи"
RU[menu_exit]="Выход"
RU[menu_installed]="Установлена"
RU[menu_running]="Работает"
RU[menu_not_installed]="Не установлена"
RU[menu_stopped]="Остановлена"
RU[menu_choose]="Выберите действие"
RU[menu_prompt]="Введите номер"
RU[back]="Назад в меню"
RU[enter]="Нажмите Enter чтобы продолжить..."
RU[yes]="да"
RU[no]="нет"
RU[confirm]="Вы уверены?"
RU[proceed]="Продолжить?"
RU[skip]="Пропустить"
RU[done]="Готово"
RU[fail]="Ошибка"
RU[cancelled]="Отменено"

RU[install_begin]="Начало установки AustoBill"
RU[install_step1]="Обновление пакетов системы"
RU[install_step2]="Установка зависимостей (curl, wget, git, nginx, certbot)"
RU[install_step3]="Создание директории"
RU[install_step4]="Скачивание репозитория"
RU[install_step5]="Установка Node.js 20.x LTS"
RU[install_step6]="Установка npm зависимостей"
RU[install_step7]="Сборка фронтенда"
RU[install_step8]="Настройка systemd сервиса"
RU[install_step9]="Настройка Nginx"
RU[install_step10]="Настройка фаервола"
RU[install_done]="Установка завершена!"
RU[install_already]="AustoBill уже установлен в $DIR"
RU[install_update_first]="Используйте пункт обновления"

RU[cfg_domain]="Введите ваш домен (например, bill.example.com)"
RU[cfg_domain_help]="Будет использован для Nginx и Let's Encrypt"
RU[cfg_ptero_url]="Введите URL вашей Pterodactyl панели"
RU[cfg_ptero_url_help]="например, https://panel.example.com"
RU[cfg_ptero_key]="Введите Admin API ключ Pterodactyl"
RU[cfg_ptero_key_help]="Создать в Admin → Application API (ptla_...)"
RU[cfg_discord_id]="Введите Discord OAuth2 Client ID"
RU[cfg_discord_id_help]="Оставьте пустым чтобы пропустить Discord вход"
RU[cfg_discord_secret]="Введите Discord OAuth2 Client Secret"
RU[cfg_discord_secret_help]="Оставьте пустым чтобы пропустить Discord вход"
RU[cfg_smtp_host]="Введите SMTP хост"
RU[cfg_smtp_host_help]="Оставьте пустым чтобы отключить почту (по умолч.: connect.smtp.bz)"
RU[cfg_smtp_port]="Введите SMTP порт"
RU[cfg_smtp_user]="Введите SMTP пользователя"
RU[cfg_smtp_pass]="Введите SMTP пароль"
RU[cfg_smtp_from]="Введите SMTP from адрес"
RU[cfg_admin_email]="Введите email администратора"
RU[cfg_admin_email_help]="Используется для создания админ-аккаунта"
RU[cfg_admin_pass]="Введите пароль администратора"
RU[cfg_admin_pass_help]="Мин. 8 символов, буквы и цифры"
RU[cfg_yoomoney_wallet]="Введите номер кошелька YooMoney"
RU[cfg_yoomoney_wallet_help]="Оставьте пустым чтобы отключить YooMoney"
RU[cfg_yoomoney_secret]="Введите YooMoney секрет уведомлений"
RU[cfg_platega_merchant]="Введите Platega Merchant ID"
RU[cfg_platega_merchant_help]="Оставьте пустым чтобы отключить Platega"
RU[cfg_platega_secret]="Введите Platega секретный ключ"
RU[cfg_proxmox_host]="Введите URL Proxmox хоста"
RU[cfg_proxmox_host_help]="Оставьте пустым чтобы отключить Proxmox (например, https://proxmox:8006)"
RU[cfg_proxmox_token]="Введите Proxmox API token ID"
RU[cfg_proxmox_token_help]="Формат: user@pam!tokenname"
RU[cfg_proxmox_secret]="Введите Proxmox API token secret"
RU[cfg_proxmox_node]="Введите имя ноды Proxmox"
RU[cfg_encryption_key]="Сгенерировать ключ шифрования автоматически?"
RU[cfg_encryption_key_help]="Необходим для шифрования паролей Pterodactyl"

RU[uninstall_warn]="ВНИМАНИЕ: Это удалит AustoBill и ВСЕ данные"
RU[uninstall_warn2]="Будут удалены:"
RU[uninstall_warn3]="- Все файлы в $DIR"
RU[uninstall_warn4]="- База данных (SQLite)"
RU[uninstall_warn5]="- Nginx конфигурация"
RU[uninstall_warn6]="- Systemd сервис"
RU[uninstall_step1]="Остановка сервиса"
RU[uninstall_step2]="Удаление Nginx конфигурации"
RU[uninstall_step3]="Удаление сервиса"
RU[uninstall_step4]="Удаление файлов"
RU[uninstall_done]="AustoBill удалён"

RU[update_step1]="Создание бэкапа"
RU[update_step2]="Скачивание обновлений"
RU[update_step3]="Обновление файлов"
RU[update_step4]="Пересборка фронтенда"
RU[update_step5]="Перезапуск сервиса"
RU[update_done]="Обновление завершено!"
RU[update_backup]="Бэкап сохранён в"

RU[ssl_install]="Установка SSL сертификата Let's Encrypt"
RU[ssl_domain]="Введите ваш домен (например, bill.example.com)"
RU[ssl_check]="Убедитесь что DNS A-запись указывает на этот сервер"
RU[ssl_email]="Введите email для уведомлений Let's Encrypt"
RU[ssl_success]="SSL сертификат установлен!"
RU[ssl_auto]="Автообновление настроено автоматически"

RU[post_url]="Сайт"
RU[post_dir]="Директория"
RU[post_admin]="Админ панель"
RU[post_email]="Email"
RU[post_pass]="Пароль"
RU[post_next]="Следующие шаги"
RU[post_next1]="Настройте DNS A-запись для вашего домена"
RU[post_next2]="Установите SSL через Let's Encrypt"
RU[post_next3]="Настройте интеграцию с Pterodactyl в админке"
RU[post_next4]="Добавьте платёжные шлюзы в админке"
RU[post_commands]="Полезные команды"
RU[post_cmd_status]="Проверить статус сервиса"
RU[post_cmd_restart]="Перезапустить сервис"
RU[post_cmd_logs]="Смотреть логи в реальном времени"
RU[post_cmd_logs_n]="Последние 100 строк лога"
RU[post_cmd_rebuild]="Пересобрать фронтенд после обновления"
RU[post_manage]="Перезапустите скрипт: sudo bash install.sh"

# Settings
RU[menu_settings]="Настройки"
RU[settings_title]="Конфигурация"
RU[settings_ptero]="Настройки Pterodactyl"
RU[settings_discord]="Настройки Discord OAuth2"
RU[settings_smtp]="Настройки SMTP / Email"
RU[settings_yoomoney]="Настройки YooMoney"
RU[settings_platega]="Настройки Platega"
RU[settings_proxmox]="Настройки Proxmox"
RU[settings_admin]="Учётные данные администратора"
RU[settings_encryption]="Ключ шифрования"
RU[settings_domain]="Домен / Frontend URL"
RU[settings_back]="Назад в главное меню"
RU[settings_current]="Текущее значение"
RU[settings_new]="Введите новое значение (или Enter чтобы оставить)"
RU[settings_updated]="Настройка обновлена"
RU[settings_key_regenerated]="Ключ шифрования успешно перегенерирован"

# reCAPTCHA
RU[cfg_recaptcha_ask]="Включить reCAPTCHA для форм входа/регистрации?"
RU[cfg_recaptcha_site_key]="Введите Site Key (v2)"
RU[cfg_recaptcha_site_key_help]="Получить на https://www.google.com/recaptcha/admin"
RU[cfg_recaptcha_secret_key]="Введите Secret Key"
RU[settings_recaptcha]="Настройки reCAPTCHA"

# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

T() {
  local key="$1"
  if [[ "$LANG" == "ru" && -n "${RU[$key]}" ]]; then
    echo -e "${RU[$key]}"
  else
    echo -e "${EN[$key]}"
  fi
}

log()  { echo -e "  ${G}✓${N} $1"; }
warn() { echo -e "  ${Y}⚠${N} $1"; }
fail() { echo -e "  ${R}✗${N} $1"; }
info() { echo -e "  ${B}→${N} $1"; }

header() {
  clear
  echo ""
  echo -e "  ${C}╔══════════════════════════════════════════════════╗${N}"
  echo -e "  ${C}║${N}      ${W}AustoBill${N} ${D}$(T version)${N}                ${C}║${N}"
  echo -e "  ${C}║${N}      ${D}$(T title)${N}             ${C}║${N}"
  echo -e "  ${C}╚══════════════════════════════════════════════════╝${N}"
  echo ""
}

step() {
  local num=$1; shift
  echo -e "\n  ${B}[${num}]${N} $*"
}

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default="${3:-}"
  local help_text="${4:-}"
  local is_secret="${5:-false}"

  if [[ -n "$help_text" ]]; then
    echo -e "  ${D}${help_text}${N}"
  fi

  if [[ -z "$default" ]]; then
    if [[ "$is_secret" == "true" ]]; then
      read -s -p "  ${prompt_text}: " "$var_name" </dev/tty
      echo ""
    else
      read -p "  ${prompt_text}: " "$var_name" </dev/tty
    fi
  else
    if [[ "$is_secret" == "true" ]]; then
      read -s -p "  ${prompt_text} [${default}]: " "$var_name" </dev/tty
      echo ""
    else
      read -p "  ${prompt_text} [${default}]: " "$var_name" </dev/tty
    fi
    [[ -z "${!var_name}" ]] && eval "$var_name=\"$default\""
  fi
}

confirm() {
  local msg="${1:-$(T proceed)}"
  local yn
  read -p "  ${msg} (y/N): " yn </dev/tty
  [[ "$yn" =~ ^[Yy$(T yes)]$ ]]
}

pause() {
  read -p "  $(T enter)..." </dev/tty
}

wait_spinner() {
  local pid=$!; local delay=0.1; local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  while kill -0 "$pid" 2>/dev/null; do
    for ((i=0; i<${#spin}; i++)); do
      printf "\r  ${C}%s${N} %s" "${spin:$i:1}" "$1"
      sleep $delay
    done
  done
  printf "\r  ${G}✓${N} %s\n" "$1"
}

spinner() {
  local msg="$1"
  shift
  ("$@" > /dev/null 2>&1) &
  wait_spinner "$msg"
}

check_root() {
  if [[ "$EUID" -ne 0 ]]; then
    echo -e "\n  ${R}$(T root_err)${N}\n"
    exit 1
  fi
}

get_ip() {
  curl -s --max-time 5 ifconfig.me 2>/dev/null || \
  curl -s --max-time 5 icanhazip.com 2>/dev/null || \
  echo "SERVER_IP"
}

# ═══════════════════════════════════════════════════════════════
# ENV HELPERS
# ═══════════════════════════════════════════════════════════════

get_env() {
  local key="$1"
  while IFS= read -r line; do
    if [[ "$line" =~ ^${key}= ]]; then
      echo "${line#*=}"
      return
    fi
  done < "$ENV_FILE" 2>/dev/null
  echo ""
}

set_env() {
  local key="$1"
  local value="$2"
  local tmp
  tmp=$(mktemp)
  local found=0
  while IFS= read -r line; do
    if [[ "$line" =~ ^${key}= ]]; then
      echo "${key}=${value}" >> "$tmp"
      found=1
    else
      echo "$line" >> "$tmp"
    fi
  done < "$ENV_FILE"
  if [[ "$found" -eq 0 ]]; then
    echo "${key}=${value}" >> "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

edit_env_var() {
  local key="$1"
  local prompt_text="$2"
  local is_secret="${3:-false}"
  local current

  current=$(get_env "$key")
  echo -e "  ${D}$(T settings_current): ${W}${current:-${D}<empty>}${N}"
  if [[ "$is_secret" == "true" ]]; then
    read -s -p "  ${prompt_text}: " new_value
    echo ""
  else
    read -p "  ${prompt_text}: " new_value
  fi
  if [[ -n "$new_value" ]]; then
    set_env "$key" "$new_value"
    log "$(T settings_updated): ${key}"
  else
    warn "$(T skip)"
  fi
}

# ═══════════════════════════════════════════════════════════════
# LANGUAGE SELECTION
# ═══════════════════════════════════════════════════════════════

select_language() {
  clear
  echo ""
  echo -e "  ${C}╔══════════════════════════════════════════════════╗${N}"
  echo -e "  ${C}║${N}          ${W}AustoBill Installer${N}                 ${C}║${N}"
  echo -e "  ${C}║${N}          ${D}$(T version)${N}                         ${C}║${N}"
  echo -e "  ${C}╚══════════════════════════════════════════════════╝${N}"
  echo ""
  echo -e "  ${W}$(T lang_prompt):${N}"
  echo ""
  echo -e "    ${C}1)${N} ${W}$(T lang_en)${N}"
  echo -e "    ${C}2)${N} ${W}$(T lang_ru)${N}"
  echo ""
  read -p "  > " lang_choice </dev/tty
  case "$lang_choice" in
    2|ru|rus|рус) LANG="ru" ;;
    *) LANG="en" ;;
  esac
}

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION WIZARD
# ═══════════════════════════════════════════════════════════════

generate_env() {
  local domain ptero_url ptero_key
  local discord_id discord_secret
  local smtp_host smtp_port smtp_user smtp_pass smtp_from
  local admin_email admin_pass
  local yoomoney_wallet yoomoney_secret
  local platega_merchant platega_secret
  local proxmox_host proxmox_token proxmox_secret proxmox_node
  local enc_key recaptcha_enable recaptcha_site_key recaptcha_secret_key

  echo ""
  echo -e "  ${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "  ${W}  $(T install_begin)${N}"
  echo -e "  ${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo ""

  # ── Domain ──
  prompt "domain" "$(T cfg_domain)" "" "$(T cfg_domain_help)"

  # ── Pterodactyl ──
  echo ""
  echo -e "  ${B}── Pterodactyl ──${N}"
  prompt "ptero_url" "$(T cfg_ptero_url)" "https://panel.${domain:-example.com}" "$(T cfg_ptero_url_help)"
  prompt "ptero_key" "$(T cfg_ptero_key)" "" "$(T cfg_ptero_key_help)" "true"

  # ── Discord ──
  echo ""
  echo -e "  ${B}── Discord OAuth2 ──${N}"
  prompt "discord_id" "$(T cfg_discord_id)" "" "$(T cfg_discord_id_help)"
  prompt "discord_secret" "$(T cfg_discord_secret)" "" "$(T cfg_discord_secret_help)" "true"

  # ── SMTP ──
  echo ""
  echo -e "  ${B}── SMTP / Email ──${N}"
  prompt "smtp_host" "$(T cfg_smtp_host)" "connect.smtp.bz" "$(T cfg_smtp_host_help)"
  if [[ -n "$smtp_host" ]]; then
    prompt "smtp_port" "$(T cfg_smtp_port)" "587"
    prompt "smtp_user" "$(T cfg_smtp_user)" "noreply@${domain:-example.com}"
    prompt "smtp_pass" "$(T cfg_smtp_pass)" "" "" "true"
    prompt "smtp_from" "$(T cfg_smtp_from)" "noreply@${domain:-example.com}"
  fi

  # ── reCAPTCHA ──
  echo ""
  echo -e "  ${B}── reCAPTCHA ──${N}"
  if confirm "$(T cfg_recaptcha_ask)"; then
    recaptcha_enable="true"
    prompt "recaptcha_site_key" "$(T cfg_recaptcha_site_key)" "" "$(T cfg_recaptcha_site_key_help)"
    prompt "recaptcha_secret_key" "$(T cfg_recaptcha_secret_key)" "" "" "true"
  fi

  # ── Admin ──
  echo ""
  echo -e "  ${B}── $(T post_admin) ──${N}"
  prompt "admin_email" "$(T cfg_admin_email)" "admin@${domain:-example.com}" "$(T cfg_admin_email_help)"
  prompt "admin_pass" "$(T cfg_admin_pass)" "" "$(T cfg_admin_pass_help)" "true"

  # ── Encryption Key ──
  echo ""
  echo -e "  ${B}── Encryption ──${N}"
  if confirm "$(T cfg_encryption_key)"; then
    enc_key=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)
    if [[ -z "$enc_key" ]]; then
      enc_key=$(head -c 64 /dev/urandom | xxd -p -c 64 2>/dev/null || echo "")
    fi
    if [[ -z "$enc_key" ]]; then
      warn "$(T skip) — could not generate"
    fi
  fi

  # ── Payments ──
  echo ""
  echo -e "  ${B}── YooMoney ──${N}"
  prompt "yoomoney_wallet" "$(T cfg_yoomoney_wallet)" "" "$(T cfg_yoomoney_wallet_help)"
  if [[ -n "$yoomoney_wallet" ]]; then
    prompt "yoomoney_secret" "$(T cfg_yoomoney_secret)" "" "" "true"
  fi

  echo ""
  echo -e "  ${B}── Platega ──${N}"
  prompt "platega_merchant" "$(T cfg_platega_merchant)" "" "$(T cfg_platega_merchant_help)"
  if [[ -n "$platega_merchant" ]]; then
    prompt "platega_secret" "$(T cfg_platega_secret)" "" "" "true"
  fi

  # ── Proxmox ──
  echo ""
  echo -e "  ${B}── Proxmox VE (for VPS) ──${N}"
  prompt "proxmox_host" "$(T cfg_proxmox_host)" "" "$(T cfg_proxmox_host_help)"
  if [[ -n "$proxmox_host" ]]; then
    prompt "proxmox_token" "$(T cfg_proxmox_token)" "" "$(T cfg_proxmox_token_help)"
    prompt "proxmox_secret" "$(T cfg_proxmox_secret)" "" "" "true"
    prompt "proxmox_node" "$(T cfg_proxmox_node)" "pve"
  fi

  # ── Write .env ──
  mkdir -p "$DIR"
  echo "# AustoBill Configuration" > "$ENV_FILE"
  echo "# Generated by install.sh on $(date)" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"

  cat >> "$ENV_FILE" <<EOF
# ========== SERVER ==========
PORT=3000
APP_NAME=AustoBill

# ========== DOMAIN ==========
FRONTEND_URL=https://${domain}

# ========== DISCORD OAUTH2 ==========
DISCORD_CLIENT_ID=${discord_id:-}
DISCORD_CLIENT_SECRET=${discord_secret:-}
DISCORD_REDIRECT_URI=https://${domain}/api/auth/discord/callback

# ========== DISCORD LOGGING ==========
DISCORD_WEBHOOK_URL=

# ========== ENCRYPTION ==========
ENCRYPTION_KEY=${enc_key:-}

# ========== SMTP / EMAIL ==========
SMTP_HOST=${smtp_host:-}
SMTP_PORT=${smtp_port:-587}
SMTP_SECURE=false
SMTP_USER=${smtp_user:-}
SMTP_PASS=${smtp_pass:-}
SMTP_FROM=${smtp_from:-}

# ========== RECAPTCHA ==========
RECAPTCHA_ENABLED=${recaptcha_enable:-false}
RECAPTCHA_SECRET_KEY=${recaptcha_secret_key:-}
RECAPTCHA_FAIL_OPEN_ON_NETWORK_ERROR=false

# ========== PTERODACTYL ==========
PTERO_URL=${ptero_url}
PTERO_ADMIN_KEY=${ptero_key}

# ========== PROXMOX (для VDS/VPS) ==========
PROXMOX_HOST=${proxmox_host:-}
PROXMOX_TOKEN_ID=${proxmox_token:-}
PROXMOX_TOKEN_SECRET=${proxmox_secret:-}
PROXMOX_NODE=${proxmox_node:-}
PROXMOX_STORAGE=local
PROXMOX_TEMPLATE=
PROXMOX_VERIFY_SSL=false

# ========== YOOMONEY ==========
YOOMONEY_WALLET=${yoomoney_wallet:-}
YOOMONEY_SECRET=${yoomoney_secret:-}

# ========== 2328.IO (криптоплатежи) ==========
PAYMENT_2328_PROJECT=
PAYMENT_2328_API_KEY=

# ========== PLATEGA.IO ==========
PLATEGA_MERCHANT_ID=${platega_merchant:-}
PLATEGA_SECRET_KEY=${platega_secret:-}
PLATEGA_API_URL=https://app.platega.io

# ========== ADMIN SEED ==========
ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_pass}

# ========== VITE FRONTEND ==========
VITE_APP_NAME=AustoBill
VITE_RECAPTCHA_SITE_KEY=${recaptcha_site_key:-}
EOF

  chmod 600 "$ENV_FILE"
  log ".env created at $ENV_FILE"
}

# ═══════════════════════════════════════════════════════════════
# INSTALL
# ═══════════════════════════════════════════════════════════════

install_panel() {
  if [[ -d "$DIR" && -f "$DIR/server.js" ]]; then
    echo ""
    warn "$(T install_already)"
    warn "$(T install_update_first)"
    pause
    return
  fi

  generate_env

  echo ""
  echo -e "  ${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "  ${W}  $(T install_begin)${N}"
  echo -e "  ${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo ""

  step "1" "$(T install_step1)..."
  apt update -qq > /dev/null 2>&1 || true; apt upgrade -y -qq > /dev/null 2>&1 || true
  log "$(T done)"

  step "2" "$(T install_step2)..."
  apt install -y -qq curl wget git nano ufw nginx certbot python3-certbot-nginx > /dev/null 2>&1 || true
  log "$(T done)"

  step "3" "$(T install_step3)..."
  mkdir -p "$DIR" 2>/dev/null || true
  log "$(T done)"

  step "4" "$(T install_step4)..."
  local tmp_dir
  tmp_dir=$(mktemp -d)
  cd "$tmp_dir"
  git clone "$REPO_URL" . > /dev/null 2>&1 || {
    fail "$(T fail)"
    rm -rf "$tmp_dir"
    pause
    return
  }
  cp -r ./* "$DIR/" 2>/dev/null || cp -r . "$DIR/"
  rm -rf "$tmp_dir"
  log "$(T done)"

  step "5" "$(T install_step5)..."
  if command -v node &> /dev/null; then
    local nv
    nv=$(node -v)
    warn "Node.js $nv ($(T skip))"
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1 || true
    apt install -y -qq nodejs > /dev/null 2>&1 || true
    log "Node.js $(node -v)"
  fi

  cd "$DIR"

  step "6" "$(T install_step6)..."
  npm install --silent > /dev/null 2>&1 || true
  log "$(T done)"

  step "7" "$(T install_step7)..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  npm run build 2>&1 || fail "Build failed — check output above"
  log "$(T done)"

  step "8" "$(T install_step8)..."
  cat > /etc/systemd/system/$SERVICE.service << 'SEOF'
[Unit]
Description=AustoBill Billing Service
Documentation=https://github.com/austobill
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DIR
ExecStart=/usr/bin/node $DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal
SyslogIdentifier=austobill

[Install]
WantedBy=multi-user.target
SEOF
  systemctl daemon-reload
  systemctl enable $SERVICE > /dev/null 2>&1
  systemctl start $SERVICE
  log "$(T done)"

  step "9" "$(T install_step9)..."
  cat > /etc/nginx/sites-available/$SERVICE << 'NEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }
}
NEOF

  if [[ -n "$domain" ]]; then
    sed -i "s/server_name _;/server_name ${domain};/" /etc/nginx/sites-available/$SERVICE
  fi

  ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t > /dev/null 2>&1 && systemctl restart nginx
  log "$(T done)"

  step "10" "$(T install_step10)..."
  ufw allow 22 > /dev/null 2>&1
  ufw allow 80 > /dev/null 2>&1
  ufw allow 443 > /dev/null 2>&1
  ufw --force enable > /dev/null 2>&1
  log "$(T done)"

  # ── Done ──
  local ip
  ip=$(get_ip)
  echo ""
  echo -e "  ${G}════════════════════════════════════════════════════${N}"
  echo -e "  ${G}  ✅ $(T install_done)${N}"
  echo -e "  ${G}════════════════════════════════════════════════════${N}"
  echo ""
  echo -e "  ${B}$(T post_url):${N}      http://${ip} (or https://${domain})"
  echo -e "  ${B}$(T post_dir):${N} $DIR"
  echo ""
  echo -e "  ${W}━━━ $(T post_admin) ━━━${N}"
  echo -e "  ${B}$(T post_email):${N}  ${admin_email}"
  echo -e "  ${B}$(T post_pass):${N}   ${admin_pass}"
  echo ""
  echo -e "  ${W}━━━ $(T post_next) ━━━${N}"
  echo -e "  ${C}1.${N} $(T post_next1)"
  echo -e "  ${C}2.${N} $(T post_next2)"
  echo -e "  ${C}3.${N} $(T post_next3)"
  echo -e "  ${C}4.${N} $(T post_next4)"
  echo ""
  echo -e "  ${W}━━━ $(T post_commands) ━━━${N}"
  echo -e "  ${C}systemctl status $SERVICE${N}       — $(T post_cmd_status)"
  echo -e "  ${C}systemctl restart $SERVICE${N}      — $(T post_cmd_restart)"
  echo -e "  ${C}journalctl -u $SERVICE -f${N}       — $(T post_cmd_logs)"
  echo -e "  ${C}journalctl -u $SERVICE -n 100${N}   — $(T post_cmd_logs_n)"
  echo -e "  ${C}cd $DIR && npm run build${N}         — $(T post_cmd_rebuild)"
  echo ""
  echo -e "  ${D}$(T post_manage)${N}"
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# UNINSTALL
# ═══════════════════════════════════════════════════════════════

uninstall_panel() {
  header
  if [[ ! -d "$DIR" ]]; then
    warn "$(T menu_not_installed)"
    pause
    return
  fi

  echo -e "  ${R}⚠ $(T uninstall_warn)${N}"
  echo ""
  echo -e "  ${R}● $(T uninstall_warn2)${N}"
  echo -e "  ${R}● $(T uninstall_warn3)${N}"
  echo -e "  ${R}● $(T uninstall_warn4)${N}"
  echo -e "  ${R}● $(T uninstall_warn5)${N}"
  echo -e "  ${R}● $(T uninstall_warn6)${N}"
  echo ""
  if ! confirm "$(T confirm)"; then
    echo -e "  ${Y}$(T cancelled)${N}"
    pause
    return
  fi

  echo ""
  step "1" "$(T uninstall_step1)..."
  systemctl stop $SERVICE 2>/dev/null || true
  systemctl disable $SERVICE 2>/dev/null || true
  log "$(T done)"

  step "2" "$(T uninstall_step2)..."
  rm -f /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/$SERVICE
  systemctl restart nginx 2>/dev/null || true
  log "$(T done)"

  step "3" "$(T uninstall_step3)..."
  rm -f /etc/systemd/system/$SERVICE.service
  systemctl daemon-reload
  log "$(T done)"

  step "4" "$(T uninstall_step4)..."
  rm -rf "$DIR"
  log "$(T done)"

  echo ""
  echo -e "  ${G}✅ $(T uninstall_done)${N}"
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# UPDATE
# ═══════════════════════════════════════════════════════════════

update_panel() {
  header
  if [[ ! -d "$DIR" ]]; then
    warn "$(T menu_not_installed)"
    pause
    return
  fi

  echo -e "  ${W}━━━ $(T menu_update) ━━━${N}"
  echo ""

  step "1" "$(T update_step1)..."
  local backup
  backup="${DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  cp -r "$DIR" "$backup"
  log "$(T update_backup): $backup"

  step "2" "$(T update_step2)..."
  local tmp_dir
  tmp_dir=$(mktemp -d)
  cd "$tmp_dir"
  git clone "$REPO_URL" . > /dev/null 2>&1 || {
    fail "$(T fail)"
    rm -rf "$tmp_dir"
    pause
    return
  }
  log "$(T done)"

  step "3" "$(T update_step3)..."
  systemctl stop $SERVICE
  # Keep .env, node_modules, dist, uploads, *.db
  local env_backup
  env_backup=$(mktemp)
  [[ -f "$DIR/.env" ]] && cp "$DIR/.env" "$env_backup"

  cp -r ./* "$DIR/" 2>/dev/null || cp -r . "$DIR/"
  rm -rf "$tmp_dir"

  # Restore .env
  [[ -f "$env_backup" ]] && cp "$env_backup" "$DIR/.env" && rm -f "$env_backup"
  log "$(T done)"

  cd "$DIR"

  step "4" "$(T update_step4)..."
  npm install --silent > /dev/null 2>&1
  export NODE_OPTIONS="--max-old-space-size=2048"
  npm run build > /dev/null 2>&1
  log "$(T done)"

  step "5" "$(T update_step5)..."
  systemctl start $SERVICE
  sleep 2
  if systemctl is-active --quiet $SERVICE; then
    log "$(T done)"
  else
    fail "$(T fail) — check: journalctl -u $SERVICE -f"
  fi

  echo ""
  echo -e "  ${G}✅ $(T update_done)${N}"
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# SSL
# ═══════════════════════════════════════════════════════════════

setup_ssl() {
  header
  echo -e "  ${W}━━━ $(T ssl_install) ━━━${N}"
  echo ""

  local domain email
  prompt "domain" "$(T ssl_domain)" "" "$(T ssl_check)"
  prompt "email" "$(T ssl_email)" ""

  if [[ -z "$domain" ]]; then
    warn "$(T cancelled)"
    pause
    return
  fi

  sed -i "s/server_name _;/server_name ${domain};/" /etc/nginx/sites-available/$SERVICE 2>/dev/null || true
  nginx -t > /dev/null 2>&1 && systemctl restart nginx

  certbot --nginx -d "$domain" ${email:+-m "$email"} --agree-tos --non-interactive || {
    certbot --nginx -d "$domain" ${email:+-m "$email"}
  }

  echo ""
  echo -e "  ${G}✅ $(T ssl_success)${N}"
  echo -e "  ${D}$(T ssl_auto)${N}"
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# BACKUP
# ═══════════════════════════════════════════════════════════════

create_backup() {
  header
  if [[ ! -d "$DIR" ]]; then
    warn "$(T menu_not_installed)"
    pause
    return
  fi

  local backup
  backup="${DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  echo -e "  ${B}→${N} $(T update_step1)..."
  cp -r "$DIR" "$backup"
  log "$(T update_backup): $backup"
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# SETTINGS (INTERACTIVE .ENV EDITOR)
# ═══════════════════════════════════════════════════════════════

cfg_pterodactyl() {
  header
  echo -e "  ${W}━━━ $(T settings_ptero) ━━━${N}\n"
  edit_env_var "PTERO_URL" "$(T cfg_ptero_url)"
  edit_env_var "PTERO_ADMIN_KEY" "$(T cfg_ptero_key)" "true"
  echo ""; pause
}

cfg_discord() {
  header
  echo -e "  ${W}━━━ $(T settings_discord) ━━━${N}\n"
  edit_env_var "DISCORD_CLIENT_ID" "$(T cfg_discord_id)"
  edit_env_var "DISCORD_CLIENT_SECRET" "$(T cfg_discord_secret)" "true"
  edit_env_var "DISCORD_WEBHOOK_URL" "Discord Webhook URL"
  local domain
  domain=$(get_env "FRONTEND_URL" | sed 's|https://||')
  if [[ -n "$domain" ]]; then
    echo -e "  ${D}Redirect URI: https://${domain}/api/auth/discord/callback${N}"
  fi
  echo ""; pause
}

cfg_smtp() {
  header
  echo -e "  ${W}━━━ $(T settings_smtp) ━━━${N}\n"
  edit_env_var "SMTP_HOST" "$(T cfg_smtp_host)"
  edit_env_var "SMTP_PORT" "$(T cfg_smtp_port)"
  edit_env_var "SMTP_SECURE" "SMTP Secure (true/false)"
  edit_env_var "SMTP_USER" "$(T cfg_smtp_user)"
  edit_env_var "SMTP_PASS" "$(T cfg_smtp_pass)" "true"
  edit_env_var "SMTP_FROM" "$(T cfg_smtp_from)"
  echo ""; pause
}

cfg_yoomoney() {
  header
  echo -e "  ${W}━━━ $(T settings_yoomoney) ━━━${N}\n"
  edit_env_var "YOOMONEY_WALLET" "$(T cfg_yoomoney_wallet)"
  if [[ -n "$(get_env YOOMONEY_WALLET)" ]]; then
    edit_env_var "YOOMONEY_SECRET" "$(T cfg_yoomoney_secret)" "true"
  fi
  echo ""; pause
}

cfg_platega() {
  header
  echo -e "  ${W}━━━ $(T settings_platega) ━━━${N}\n"
  edit_env_var "PLATEGA_MERCHANT_ID" "$(T cfg_platega_merchant)"
  if [[ -n "$(get_env PLATEGA_MERCHANT_ID)" ]]; then
    edit_env_var "PLATEGA_SECRET_KEY" "$(T cfg_platega_secret)" "true"
  fi
  edit_env_var "PLATEGA_API_URL" "Platega API URL"
  echo ""; pause
}

cfg_proxmox() {
  header
  echo -e "  ${W}━━━ $(T settings_proxmox) ━━━${N}\n"
  edit_env_var "PROXMOX_HOST" "$(T cfg_proxmox_host)"
  if [[ -n "$(get_env PROXMOX_HOST)" ]]; then
    edit_env_var "PROXMOX_TOKEN_ID" "$(T cfg_proxmox_token)"
    edit_env_var "PROXMOX_TOKEN_SECRET" "$(T cfg_proxmox_secret)" "true"
    edit_env_var "PROXMOX_NODE" "$(T cfg_proxmox_node)"
  fi
  echo ""; pause
}

cfg_admin() {
  header
  echo -e "  ${W}━━━ $(T settings_admin) ━━━${N}\n"
  edit_env_var "ADMIN_EMAIL" "$(T cfg_admin_email)"
  edit_env_var "ADMIN_PASSWORD" "$(T cfg_admin_pass)" "true"
  echo ""; pause
}

cfg_encryption() {
  header
  echo -e "  ${W}━━━ $(T settings_encryption) ━━━${N}\n"
  local current
  current=$(get_env "ENCRYPTION_KEY")
  echo -e "  ${D}$(T settings_current): ${W}${current:+****${current: -4}}${current:-${D}<empty>}${N}"
  if confirm "$(T cfg_encryption_key)"; then
    local new_key
    new_key=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)
    if [[ -n "$new_key" ]]; then
      set_env "ENCRYPTION_KEY" "$new_key"
      log "$(T settings_key_regenerated)"
    else
      warn "$(T skip)"
    fi
  fi
  echo ""; pause
}

cfg_domain() {
  header
  echo -e "  ${W}━━━ $(T settings_domain) ━━━${N}\n"
  edit_env_var "FRONTEND_URL" "$(T cfg_domain)"
  local domain
  domain=$(get_env "FRONTEND_URL" | sed 's|https://||')
  if [[ -f "/etc/nginx/sites-available/$SERVICE" && -n "$domain" ]]; then
    sed -i "s/server_name .*/server_name ${domain};/" /etc/nginx/sites-available/$SERVICE
    nginx -t > /dev/null 2>&1 && systemctl restart nginx 2>/dev/null
    log "Nginx config updated"
  fi
  echo ""; pause
}

cfg_recaptcha() {
  header
  echo -e "  ${W}━━━ $(T settings_recaptcha) ━━━${N}\n"
  local current_enabled
  current_enabled=$(get_env "RECAPTCHA_ENABLED")
  echo -e "  ${D}$(T settings_current): ${W}RECAPTCHA_ENABLED=${current_enabled:-false}${N}"
  if confirm "$(T cfg_recaptcha_ask)"; then
    set_env "RECAPTCHA_ENABLED" "true"
    edit_env_var "VITE_RECAPTCHA_SITE_KEY" "$(T cfg_recaptcha_site_key)"
    edit_env_var "RECAPTCHA_SECRET_KEY" "$(T cfg_recaptcha_secret_key)" "true"
    log "RECAPTCHA_ENABLED=true"
  else
    set_env "RECAPTCHA_ENABLED" "false"
    set_env "VITE_RECAPTCHA_SITE_KEY" ""
    set_env "RECAPTCHA_SECRET_KEY" ""
    log "RECAPTCHA_ENABLED=false"
  fi
  echo -e "  ${Y}⚠${N} $(T post_cmd_rebuild) — npm run build"
  echo ""; pause
}

settings_menu() {
  while true; do
    header
    echo -e "  ${W}$(T settings_title):${N}"
    echo ""
    echo -e "  ${C}╔════════════════════════════════════════╗${N}"
    echo -e "  ${C}║${N}  ${C}1.${N}  $(T settings_ptero)        ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}2.${N}  $(T settings_discord)    ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}3.${N}  $(T settings_smtp)         ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}4.${N}  $(T settings_yoomoney)     ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}5.${N}  $(T settings_platega)      ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}6.${N}  $(T settings_proxmox)      ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}7.${N}  $(T settings_admin)      ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}8.${N}  $(T settings_encryption)  ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}9.${N}  $(T settings_domain)     ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}A.${N}  $(T settings_recaptcha)   ${C}║${N}"
    echo -e "  ${C}║${N}  ──────────────────────────────  ${C}║${N}"
    echo -e "  ${C}║${N}  ${C}0.${N}  $(T settings_back)        ${C}║${N}"
    echo -e "  ${C}╚════════════════════════════════════════╝${N}"
    echo ""
    read -p "  $(T menu_prompt) > " settings_choice </dev/tty
    case $settings_choice in
      1) cfg_pterodactyl ;;
      2) cfg_discord ;;
      3) cfg_smtp ;;
      4) cfg_yoomoney ;;
      5) cfg_platega ;;
      6) cfg_proxmox ;;
      7) cfg_admin ;;
      8) cfg_encryption ;;
      9) cfg_domain ;;
      a|A) cfg_recaptcha ;;
      0) break ;;
      *) warn "$(T menu_choose)" ; pause ;;
    esac
  done
}

# ═══════════════════════════════════════════════════════════════
# STATUS / LOGS
# ═══════════════════════════════════════════════════════════════

show_status() {
  header
  echo ""
  systemctl status $SERVICE 2>/dev/null || echo -e "  ${R}$(T menu_not_installed)${N}"
  echo ""
  pause
}

show_logs() {
  header
  echo ""
  journalctl -u $SERVICE -n 100 --no-pager 2>/dev/null || echo -e "  ${R}$(T menu_not_installed)${N}"
  echo ""
  pause
}

restart_service() {
  header
  echo ""
  if systemctl is-active --quiet $SERVICE 2>/dev/null; then
    systemctl restart $SERVICE
    log "$(T post_cmd_restart)"
  else
    warn "$(T menu_not_installed)"
  fi
  echo ""
  pause
}

# ═══════════════════════════════════════════════════════════════
# MENU
# ═══════════════════════════════════════════════════════════════

show_menu() {
  header

  # Status line
  local status_text=""
  if [[ -d "$DIR" ]]; then
    if systemctl is-active --quiet $SERVICE 2>/dev/null; then
      status_text="  ${G}● $(T menu_installed) / $(T menu_running)${N}"
    else
      status_text="  ${R}● $(T menu_installed) / $(T menu_stopped)${N}"
    fi
  else
    status_text="  ${Y}○ $(T menu_not_installed)${N}"
  fi
  echo -e "  ${W}$(T menu_title):${N}  $status_text"
  echo ""

  echo -e "  ${C}╔════════════════════════════════════════╗${N}"
  echo -e "  ${C}║${N}  ${C}1.${N}  $(T menu_install)                  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}2.${N}  $(T menu_update)                  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}3.${N}  $(T menu_uninstall)                ${C}║${N}"
  echo -e "  ${C}║${N}  ──────────────────────────────  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}4.${N}  $(T menu_ssl)               ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}5.${N}  $(T menu_backup)                ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}6.${N}  $(T menu_restart)             ${C}║${N}"
  echo -e "  ${C}║${N}  ──────────────────────────────  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}7.${N}  $(T menu_status)               ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}8.${N}  $(T menu_logs)                 ${C}║${N}"
  echo -e "  ${C}║${N}  ──────────────────────────────  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}9.${N}  $(T menu_settings)              ${C}║${N}"
  echo -e "  ${C}║${N}  ──────────────────────────────  ${C}║${N}"
  echo -e "  ${C}║${N}  ${C}0.${N}  $(T menu_exit)                       ${C}║${N}"
  echo -e "  ${C}╚════════════════════════════════════════╝${N}"
  echo ""
}

main() {
  check_root
  select_language

  while true; do
    show_menu
    read -p "  $(T menu_prompt) > " choice </dev/tty
    case $choice in
      1) install_panel ;;
      2) update_panel ;;
      3) uninstall_panel ;;
      4) setup_ssl ;;
      5) create_backup ;;
      6) restart_service ;;
       7) show_status ;;
       8) show_logs ;;
       9) settings_menu ;;
       0) echo ""; echo -e "  ${G}👋${N}"; echo ""; exit 0 ;;
      *) warn "$(T menu_choose)" ;;
    esac
  done
}

main "$@"
