"""Utility helpers for delivering transactional emails."""
from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - used only for type checking
    import models

LOGGER = logging.getLogger(__name__)


@dataclass
class SMTPSettings:
    """Configuration required to talk to the SMTP server."""

    host: str
    port: int
    username: Optional[str]
    password: Optional[str]
    use_tls: bool
    use_ssl: bool
    sender: str
    sender_name: Optional[str]


def _strtobool(value: str, default: bool = False) -> bool:
    """Return ``True`` if ``value`` represents a truthy string."""

    if value is None:
        return default

    value = value.strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _load_smtp_settings() -> Optional[SMTPSettings]:
    """Load SMTP settings from environment variables."""

    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM") or username
    sender_name = os.getenv("SMTP_FROM_NAME")

    if not host and username and username.endswith("@gmail.com"):
        # Gmail users often omit the host/port configuration.
        host = "smtp.gmail.com"

    if not sender:
        LOGGER.warning("SMTP_FROM or SMTP_USER must be set to send emails.")
        return None

    port_raw = os.getenv("SMTP_PORT")
    use_ssl = _strtobool(os.getenv("SMTP_SSL"), default=False)
    use_tls = _strtobool(os.getenv("SMTP_STARTTLS"), default=not use_ssl)

    if port_raw:
        try:
            port = int(port_raw)
        except ValueError:
            LOGGER.warning("Invalid SMTP_PORT value %s. Falling back to defaults.", port_raw)
            port = 465 if use_ssl else 587
    else:
        port = 465 if use_ssl else 587

    if not host:
        LOGGER.warning("SMTP_HOST is not configured; skipping email delivery.")
        return None

    if username and not password:
        LOGGER.warning("SMTP_PASSWORD is not configured; authentication may fail.")

    return SMTPSettings(
        host=host,
        port=port,
        username=username,
        password=password,
        use_tls=use_tls,
        use_ssl=use_ssl,
        sender=sender,
        sender_name=sender_name,
    )


def send_email(
    to_address: str,
    subject: str,
    body: str,
    *,
    html_body: Optional[str] = None,
) -> bool:
    """Send an email using the configured SMTP settings."""

    settings = _load_smtp_settings()
    if not settings:
        LOGGER.info("Email delivery skipped because SMTP settings are incomplete.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["To"] = to_address
    if settings.sender_name:
        message["From"] = formataddr((settings.sender_name, settings.sender))
    else:
        message["From"] = settings.sender
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    smtp_class = smtplib.SMTP_SSL if settings.use_ssl else smtplib.SMTP

    try:
        with smtp_class(settings.host, settings.port, timeout=10) as client:
            client.ehlo()
            if settings.use_tls and not settings.use_ssl:
                client.starttls()
                client.ehlo()
            if settings.username:
                client.login(settings.username, settings.password or "")
            client.send_message(message)
    except Exception:  # pragma: no cover - network errors are logged
        LOGGER.exception("Failed to send email to %s", to_address)
        return False

    LOGGER.info("Sent email to %s (subject=%s)", to_address, subject)
    return True


def _get_base_url() -> str:
    """Return the public base URL of the application."""

    base_url = (
        os.getenv("APP_BASE_URL")
        or os.getenv("PUBLIC_APP_URL")
        or os.getenv("FRONTEND_BASE_URL")
        or ""
    )
    return base_url.rstrip("/")


def send_password_reset_email(profile: "models.Profile", token: str) -> bool:
    """Deliver a password reset email with the provided ``token``."""

    if not profile.email:
        LOGGER.info("Skipping password reset email for %s: missing email.", profile.id)
        return False

    base_url = _get_base_url()
    reset_page = f"{base_url}/static/login.html" if base_url else "/static/login.html"
    subject = "Remember Word 비밀번호 재설정 안내"
    display_name = profile.name or profile.username or profile.email
    body = (
        f"안녕하세요 {display_name}님,\n\n"
        "Remember Word에서 비밀번호 재설정을 요청하셨습니다.\n\n"
        "아래 토큰을 비밀번호 재설정 페이지에 입력하면 새 비밀번호를 설정할 수 있습니다.\n\n"
        f"토큰: {token}\n\n"
        f"비밀번호 재설정 페이지 열기: {reset_page}\n\n"
        "만약 본인이 요청한 것이 아니라면 이 이메일을 무시하세요."
    )

    return send_email(profile.email, subject, body)
