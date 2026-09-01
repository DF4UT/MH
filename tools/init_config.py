#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知识论坛初始化配置工具
========================
功能：
  1. 交互式引导输入：数据库、GitHub OAuth、管理员、站点信息
  2. 生成 config.json（本地开发核心配置）
  3. 生成 .env.local（本地环境变量，同时是 Vercel 环境变量的来源清单）
  4. 打印部署到 Vercel 所需的环境变量列表

用法：
  python tools/init_config.py                # 交互式
  python tools/init_config.py --non-interactive \
      --site-name "知识论坛" \
      --db-type turso \
      --db-url "libsql://xxx.turso.io" \
      --db-token "your-token" \
      --github-client-id xxx --github-client-secret xxx \
      --admin-ids octocat,alice
  python tools/init_config.py --print-env    # 仅打印 Vercel 环境变量清单

依赖：仅 Python 标准库，无需安装任何第三方包。
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from dataclasses import dataclass, field

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台中文兼容
except Exception:
    pass

BANNER = """
============================================================
  知识论坛 · 初始化配置工具
  Next.js + Turso/Postgres + GitHub OAuth
============================================================
"""

DEFAULT_SITE_NAME = "知识论坛"
DEFAULT_SITE_DESC = "一个轻量级的知识技术论坛"
DEFAULT_DB_TYPE = "turso"
DEFAULT_DB_URL = "file:./data/forum.db"
DEFAULT_NEXTAUTH_URL = "http://localhost:3000"


@dataclass
class Config:
    site_name: str = DEFAULT_SITE_NAME
    site_desc: str = DEFAULT_SITE_DESC
    db_type: str = DEFAULT_DB_TYPE
    db_url: str = DEFAULT_DB_URL
    db_token: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    admin_ids: list = field(default_factory=list)
    secret: str = ""
    nextauth_url: str = DEFAULT_NEXTAUTH_URL


def ask(prompt: str, default: str = "", secret: bool = False) -> str:
    """交互式提问（支持默认值与密文输入）"""
    if default:
        prompt = prompt + " [" + default + "] "
    else:
        prompt = prompt + " "
    try:
        if secret:
            import getpass

            value = getpass.getpass(prompt)
        else:
            value = input(prompt)
    except (EOFError, KeyboardInterrupt):
        print("\n[init] 已取消")
        sys.exit(1)
    value = value.strip()
    return value if value else default


def validate_db(db_type: str, url: str) -> None:
    """校验数据库 URL 基本格式"""
    if db_type == "turso":
        if not (url.startswith("libsql://") or url.startswith("file:")):
            print("[init] ❌ Turso 数据库 URL 应以 libsql:// 或 file: 开头，当前：" + url)
            sys.exit(1)
    elif db_type == "postgres":
        if not (url.startswith("postgres://") or url.startswith("postgresql://")):
            print("[init] ❌ Postgres 连接串应以 postgres:// 或 postgresql:// 开头，当前：" + url)
            sys.exit(1)
    else:
        print("[init] ❌ 未知数据库类型：" + db_type + "（可选 turso / postgres）")
        sys.exit(1)


def validate_github(oid: str, secret: str) -> None:
    if not oid or not secret:
        print("[init] ❌ GitHub OAuth Client ID 与 Secret 不能为空")
        print("    获取方式：https://github.com/settings/developers -> New OAuth App")
        sys.exit(1)


def interactive() -> Config:
    """交互式收集配置"""
    print(BANNER)
    print("[init] 开始交互式配置，括号内为默认值，直接回车使用默认值。\n")

    cfg = Config()
    cfg.site_name = ask("站点名称", cfg.site_name)
    cfg.site_desc = ask("站点描述", cfg.site_desc)

    print("\n--- 数据库（推荐 Turso：免费、轻量、与 Vercel 集成良好）---")
    db_type = ask("数据库类型 (turso/postgres)", cfg.db_type).lower()
    cfg.db_type = db_type
    if db_type == "turso":
        cfg.db_url = ask("Turso 数据库 URL（libsql://... 或本地 file:./data/forum.db）", cfg.db_url)
        validate_db("turso", cfg.db_url)
        if cfg.db_url.startswith("libsql://"):
            cfg.db_token = ask("Turso 认证 Token（登录 https://app.turso.tech 获取）", secret=True)
    else:
        cfg.db_url = ask("Postgres 连接串（postgresql://user:pass@host:5432/db）", "")
        validate_db("postgres", cfg.db_url)

    print("\n--- GitHub OAuth（https://github.com/settings/developers）---")
    cfg.github_client_id = ask("GitHub OAuth Client ID")
    cfg.github_client_secret = ask("GitHub OAuth Client Secret", secret=True)
    validate_github(cfg.github_client_id, cfg.github_client_secret)

    print("\n--- 管理员 ---")
    admins = ask("管理员 GitHub 登录名（逗号分隔，可留空稍后补充）")
    cfg.admin_ids = [a.strip() for a in admins.split(",") if a.strip()]

    cfg.secret = secrets.token_urlsafe(32)
    print("\n[init] 已自动生成 NEXTAUTH_SECRET（会话签名密钥）")
    return cfg


def build_from_args(args: argparse.Namespace) -> Config:
    """从命令行参数构造配置"""
    cfg = Config()
    cfg.site_name = args.site_name or DEFAULT_SITE_NAME
    cfg.site_desc = args.site_desc or DEFAULT_SITE_DESC
    cfg.db_type = (args.db_type or DEFAULT_DB_TYPE).lower()
    cfg.db_url = args.db_url or DEFAULT_DB_URL
    cfg.db_token = args.db_token or ""
    cfg.github_client_id = args.github_client_id or ""
    cfg.github_client_secret = args.github_client_secret or ""
    cfg.admin_ids = [a.strip() for a in (args.admin_ids or "").split(",") if a.strip()]
    cfg.secret = args.secret or secrets.token_urlsafe(32)
    cfg.nextauth_url = args.nextauth_url or DEFAULT_NEXTAUTH_URL

    validate_db(cfg.db_type, cfg.db_url)
    if args.require_github:
        validate_github(cfg.github_client_id, cfg.github_client_secret)
    return cfg


def render_config_json(cfg: Config) -> dict:
    """生成 config.json 内容（数据库连接 + OAuth + 管理员 + 站点 + 模块开关）"""
    database = {"type": cfg.db_type, "url": cfg.db_url}
    if cfg.db_token:
        database["authToken"] = cfg.db_token
    if cfg.db_type == "postgres":
        database["connectionString"] = cfg.db_url
    return {
        "site": {"name": cfg.site_name, "description": cfg.site_desc},
        "database": database,
        "auth": {
            "githubClientId": cfg.github_client_id,
            "githubClientSecret": cfg.github_client_secret,
            "secret": cfg.secret,
        },
        "admins": cfg.admin_ids,
        "features": {
            "posts": True,
            "comments": True,
            "tags": True,
            "search": True,
            "online": True,
            "admin": True,
        },
        "pagination": {"defaultLimit": 10},
    }


def render_env_local(cfg: Config) -> str:
    """生成 .env.local 内容"""
    lines = [
        "# ===== 本文件由 tools/init_config.py 生成，请勿提交到版本库 =====",
        "",
        "# ---------- 数据库 ----------",
        "DB_TYPE=" + cfg.db_type,
    ]
    if cfg.db_type == "turso":
        lines.append("TURSO_DATABASE_URL=" + cfg.db_url)
        lines.append("TURSO_AUTH_TOKEN=" + cfg.db_token if cfg.db_token else "# TURSO_AUTH_TOKEN=your-token")
    else:
        lines.append("DATABASE_URL=" + cfg.db_url)

    lines += [
        "",
        "# ---------- GitHub OAuth ----------",
        "GITHUB_CLIENT_ID=" + cfg.github_client_id,
        "GITHUB_CLIENT_SECRET=" + cfg.github_client_secret,
        "",
        "# ---------- NextAuth ----------",
        "NEXTAUTH_URL=" + cfg.nextauth_url,
        "NEXTAUTH_SECRET=" + cfg.secret,
        "",
        "# ---------- 管理员（逗号分隔的 GitHub 登录名） ----------",
        "ADMIN_GITHUB_IDS=" + ",".join(cfg.admin_ids),
        "",
        "# ---------- 站点（构建期注入，修改后需重新构建） ----------",
        "NEXT_PUBLIC_SITE_NAME=" + cfg.site_name,
        "NEXT_PUBLIC_SITE_DESCRIPTION=" + cfg.site_desc,
        "",
    ]
    return "\n".join(lines)


def print_vercel_env(cfg: Config) -> None:
    """打印部署 Vercel 所需的环境变量清单"""
    print("\n============================================================")
    print("  部署到 Vercel 时，请在以下位置配置这些环境变量：")
    print("  Vercel Dashboard -> 项目 -> Settings -> Environment Variables")
    print("============================================================\n")
    nextauth_url = "https://你的项目名.vercel.app（部署后替换）"
    env_list = [
        ("DB_TYPE", cfg.db_type),
        ("TURSO_DATABASE_URL", cfg.db_url if cfg.db_type == "turso" else ""),
        ("TURSO_AUTH_TOKEN", cfg.db_token if cfg.db_type == "turso" else ""),
        ("DATABASE_URL", cfg.db_url if cfg.db_type == "postgres" else ""),
        ("GITHUB_CLIENT_ID", cfg.github_client_id),
        ("GITHUB_CLIENT_SECRET", cfg.github_client_secret),
        ("NEXTAUTH_SECRET", cfg.secret),
        ("NEXTAUTH_URL", nextauth_url),
        ("ADMIN_GITHUB_IDS", ",".join(cfg.admin_ids)),
        ("NEXT_PUBLIC_SITE_NAME", cfg.site_name),
        ("NEXT_PUBLIC_SITE_DESCRIPTION", cfg.site_desc),
    ]
    for name, value in env_list:
        print("  " + name + "=" + value)
    print()


def write_files(cfg: Config, out_dir: str) -> None:
    """写出 config.json 与 .env.local"""
    os.makedirs(out_dir, exist_ok=True)
    config_path = os.path.join(out_dir, "config.json")
    env_path = os.path.join(out_dir, ".env.local")

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(render_config_json(cfg), f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(env_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(render_env_local(cfg))

    print("[init] ✅ 已生成：")
    print("       " + config_path)
    print("       " + env_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="知识论坛初始化配置工具")
    parser.add_argument("--non-interactive", action="store_true", help="非交互模式（配合下方参数）")
    parser.add_argument("--site-name", default="", help="站点名称")
    parser.add_argument("--site-desc", default="", help="站点描述")
    parser.add_argument("--db-type", default="", help="数据库类型：turso | postgres")
    parser.add_argument("--db-url", default="", help="数据库 URL / 连接串")
    parser.add_argument("--db-token", default="", help="Turso 认证 Token")
    parser.add_argument("--github-client-id", default="", help="GitHub OAuth Client ID")
    parser.add_argument("--github-client-secret", default="", help="GitHub OAuth Client Secret")
    parser.add_argument("--admin-ids", default="", help="管理员 GitHub 登录名（逗号分隔）")
    parser.add_argument("--secret", default="", help="NEXTAUTH_SECRET（留空自动生成））")
    parser.add_argument("--nextauth-url", default="", help="本地 NEXTAUTH_URL，默认 http://localhost:3000")
    parser.add_argument("--out-dir", default=".", help="输出目录（默认项目根目录））")
    parser.add_argument("--require-github", action="store_true", help="非交互模式下强制校验 GitHub 凭证")
    parser.add_argument("--print-env", action="store_true", help="仅打印 Vercel 环境变量清单")
    args = parser.parse_args()

    if args.print_env:
        cfg = build_from_args(args)
        print_vercel_env(cfg)
        return

    print(BANNER)
    cfg = build_from_args(args) if args.non_interactive else interactive()
    write_files(cfg, args.out_dir)
    print_vercel_env(cfg)

    print("============================================================")
    print("  下一步：")
    print("    1. npm install")
    print("    2. npm run db:migrate      # 初始化数据库表")
    print("    3. npm run dev             # 启动开发服务器 http://localhost:3000")
    print("    4. 部署 Vercel：见 docs/DEPLOYMENT.md")
    print("============================================================")


if __name__ == "__main__":
    main()
