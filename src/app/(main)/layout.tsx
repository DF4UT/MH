/**
 * 主界面布局：冻结导航栏 + 页脚
 */
import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <Navbar />
      <main className="container main-content">{children}</main>
      <Footer />
    </div>
  );
}
