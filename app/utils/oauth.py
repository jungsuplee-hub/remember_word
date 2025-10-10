"""OAuth utilities for third-party social authentication."""
from __future__ import annotations

import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Iterable, Optional
from urllib.parse import urlencode

import httpx
from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import Session

import models


class OAuthError(RuntimeError):
    """Raised when an OAuth workflow fails."""


@dataclass(frozen=True)
class ProviderConfig:
    """Configuration describing an OAuth provider."""

    key: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: Iterable[str]
    client_id_env: str
    client_secret_env: str
    requires_secret: bool = True
    extra_authorize_params: Optional[Dict[str, str]] = None

    @property
    def client_id(self) -> str:
        client_id = os.getenv(self.client_id_env)
        if not client_id:
            raise OAuthError(
                f"환경 변수 {self.client_id_env} 가 설정되지 않아 소셜 로그인을 진행할 수 없습니다."
            )
        return client_id

    @property
    def client_secret(self) -> Optional[str]:
        secret = os.getenv(self.client_secret_env)
        if self.requires_secret and not secret:
            raise OAuthError(
                f"환경 변수 {self.client_secret_env} 가 설정되지 않아 소셜 로그인을 진행할 수 없습니다."
            )
        return secret


PROVIDERS: Dict[str, ProviderConfig] = {
    "google": ProviderConfig(
        key="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://www.googleapis.com/oauth2/v2/userinfo",
        scope=("openid", "email", "profile"),
        client_id_env="GOOGLE_CLIENT_ID",
        client_secret_env="GOOGLE_CLIENT_SECRET",
        extra_authorize_params={"access_type": "offline", "prompt": "select_account"},
    ),
    "kakao": ProviderConfig(
        key="kakao",
        authorize_url="https://kauth.kakao.com/oauth/authorize",
        token_url="https://kauth.kakao.com/oauth/token",
        userinfo_url="https://kapi.kakao.com/v2/user/me",
        scope=("profile_nickname", "account_email"),
        client_id_env="KAKAO_REST_API_KEY",
        client_secret_env="KAKAO_CLIENT_SECRET",
        requires_secret=False,
    ),
    "naver": ProviderConfig(
        key="naver",
        authorize_url="https://nid.naver.com/oauth2.0/authorize",
        token_url="https://nid.naver.com/oauth2.0/token",
        userinfo_url="https://openapi.naver.com/v1/nid/me",
        scope=(),
        client_id_env="NAVER_CLIENT_ID",
        client_secret_env="NAVER_CLIENT_SECRET",
    ),
}


def get_provider(provider_key: str) -> ProviderConfig:
    try:
        return PROVIDERS[provider_key]
    except KeyError as exc:  # pragma: no cover - defensive branch
        raise OAuthError("지원하지 않는 소셜 로그인 제공자입니다.") from exc


def build_authorization_redirect(
    provider: ProviderConfig, *, request: Request, state: str
) -> str:
    redirect_uri = str(request.url_for("oauth_callback", provider=provider.key))
    params = {
        "client_id": provider.client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    scope = " ".join(provider.scope)
    if scope:
        params["scope"] = scope
    if provider.extra_authorize_params:
        params.update(provider.extra_authorize_params)
    return f"{provider.authorize_url}?{urlencode(params)}"


async def exchange_code_for_token(
    provider: ProviderConfig,
    *,
    code: str,
    request: Request,
    state: Optional[str],
) -> Dict[str, str]:
    redirect_uri = str(request.url_for("oauth_callback", provider=provider.key))
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": provider.client_id,
    }
    if provider.key == "naver" and state:
        payload["state"] = state
    secret = provider.client_secret
    if secret:
        payload["client_secret"] = secret

    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(provider.token_url, data=payload, headers=headers)
    if response.status_code >= 400:
        raise OAuthError("토큰을 발급받는 중 오류가 발생했습니다.")

    data = response.json()
    if "access_token" not in data:
        raise OAuthError("토큰 응답에 access_token 이 포함되어 있지 않습니다.")
    return data


async def fetch_user_info(provider: ProviderConfig, token: Dict[str, str]) -> Dict[str, str]:
    access_token = token.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider.key == "naver":
            response = await client.get(provider.userinfo_url, headers=headers)
        else:
            response = await client.get(provider.userinfo_url, headers=headers, params={})

    if response.status_code >= 400:
        raise OAuthError("사용자 정보를 가져오는 중 오류가 발생했습니다.")

    data = response.json()
    if provider.key == "google":
        return {
            "id": str(data.get("id") or data.get("sub")),
            "email": data.get("email"),
            "name": data.get("name") or data.get("given_name"),
        }
    if provider.key == "kakao":
        account = data.get("kakao_account") or {}
        profile = account.get("profile") or {}
        return {
            "id": str(data.get("id")),
            "email": account.get("email"),
            "name": profile.get("nickname") or account.get("name"),
        }
    if provider.key == "naver":
        response_data = data.get("response") or {}
        return {
            "id": str(response_data.get("id")),
            "email": response_data.get("email"),
            "name": response_data.get("name"),
        }
    raise OAuthError("지원하지 않는 소셜 로그인 제공자입니다.")


def _normalise_username_seed(*values: Optional[str]) -> str:
    for value in values:
        if not value:
            continue
        slug = re.sub(r"[^a-zA-Z0-9]", "", value)
        if slug:
            return slug.lower()
    return secrets.token_hex(4)


def _generate_unique_username(
    db: Session, provider: str, email: Optional[str], name: Optional[str]
) -> str:
    base_seed = _normalise_username_seed(
        email.split("@", 1)[0] if email else None,
        name,
        provider,
    )
    base_seed = base_seed[:40] or provider

    suffix = 0
    while True:
        candidate = base_seed if suffix == 0 else f"{base_seed}{suffix}"
        exists = (
            db.query(models.Profile)
            .filter(func.lower(models.Profile.username) == func.lower(candidate))
            .one_or_none()
        )
        if not exists:
            return candidate[:50]
        suffix += 1


def _ensure_profile(
    db: Session,
    provider_key: str,
    account_id: str,
    *,
    email: Optional[str],
    name: Optional[str],
    token: Dict[str, str],
) -> models.Profile:
    social_account = (
        db.query(models.SocialAccount)
        .filter(
            models.SocialAccount.provider == provider_key,
            models.SocialAccount.provider_account_id == account_id,
        )
        .one_or_none()
    )

    expires_at: Optional[datetime] = None
    if "expires_in" in token:
        try:
            expires_at = datetime.utcnow() + timedelta(seconds=int(token["expires_in"]))
        except (TypeError, ValueError):  # pragma: no cover - defensive path
            expires_at = None

    if social_account:
        social_account.email = email or social_account.email
        social_account.name = name or social_account.name
        social_account.access_token = token.get("access_token")
        refresh_token = token.get("refresh_token")
        if refresh_token:
            social_account.refresh_token = refresh_token
        social_account.expires_at = expires_at
        profile = social_account.profile
    else:
        profile = None
        if email:
            profile = (
                db.query(models.Profile)
                .filter(func.lower(models.Profile.email) == email.lower())
                .one_or_none()
            )

        if not profile:
            username = _generate_unique_username(db, provider_key, email, name)
            profile = models.Profile(
                username=username,
                name=name or username,
                email=email,
                password_hash=None,
                is_admin=False,
            )
            db.add(profile)
            db.flush()
        else:
            updated = False
            if name and not profile.name:
                profile.name = name
                updated = True
            if email and not profile.email:
                profile.email = email
                updated = True
            if updated:
                db.add(profile)

        social_account = models.SocialAccount(
            profile_id=profile.id,
            provider=provider_key,
            provider_account_id=account_id,
            email=email,
            name=name,
            access_token=token.get("access_token"),
            refresh_token=token.get("refresh_token"),
            expires_at=expires_at,
        )
        db.add(social_account)

    return profile


async def complete_oauth_login(
    provider_key: str,
    *,
    code: str,
    request: Request,
    state: Optional[str],
    db: Session,
) -> models.Profile:
    provider = get_provider(provider_key)
    token = await exchange_code_for_token(provider, code=code, request=request, state=state)
    user_info = await fetch_user_info(provider, token)

    account_id = user_info.get("id")
    if not account_id:
        raise OAuthError("소셜 로그인에서 사용자 식별자를 확인할 수 없습니다.")

    profile = _ensure_profile(
        db,
        provider.key,
        account_id,
        email=user_info.get("email"),
        name=user_info.get("name"),
        token=token,
    )
    return profile


def generate_state() -> str:
    return secrets.token_urlsafe(24)
