/**
 * 404 页面
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container main-content not-found">
      <h1>404</h1>
      <p>页面不存在或已被删除</p>
      <Link href="/" className="btn btn-primary">
        返回首页
      </Link>
    </div>
  );
}
