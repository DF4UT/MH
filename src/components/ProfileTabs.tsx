'use client';

/**
 * 个人主页 Tab 切换：我的帖子 / 草稿箱
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

export interface ProfileTab {
  key: string;
  label: string;
  content: ReactNode;
}

export default function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="profile-tabs">
      <div className="profile-tab-bar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === active}
            className={t.key === active ? 'profile-tab active' : 'profile-tab'}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  );
}
