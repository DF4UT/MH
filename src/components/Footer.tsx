/**
 * 页脚
 */
import { getConfig } from '@/lib/config';

export default function Footer() {
  const { site } = getConfig();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <span className="footer-tech">Next.js · Turso/Postgres · GitHub OAuth</span>
      </div>
    </footer>
  );
}
