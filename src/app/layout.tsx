/**
 * 根布局：全局 Provider、主题样式、站点元信息
 */
import type { Metadata } from 'next';
import 'md-editor-rt/lib/style.css';
import './globals.css';
import Providers from '@/components/Providers';
import { ModalProvider } from '@/components/modal/ModalProvider';
import { getConfig } from '@/lib/config';

export function generateMetadata(): Metadata {
  const { site } = getConfig();
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <ModalProvider>{children}</ModalProvider>
        </Providers>
      </body>
    </html>
  );
}
