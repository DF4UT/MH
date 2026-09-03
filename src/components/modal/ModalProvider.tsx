'use client';

/**
 * 全局模态框系统（替换 window.alert / window.confirm）
 * 用法：
 *   const modal = useModal();
 *   const ok = await modal.confirm({ title: '确认删除', message: '...', danger: true });
 *   await modal.alert({ title: '提示', message: '...' });
 * 说明：同一时刻仅展示一个弹窗，请求按队列依次处理。
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ModalOptions {
  title: string;
  message?: ReactNode;
  /** confirm 模式：确定按钮为危险样式（删除类操作） */
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
}

interface PendingModal {
  kind: 'confirm' | 'alert';
  opts: ModalOptions;
  resolve: (value: boolean) => void;
}

interface ModalApi {
  confirm: (opts: ModalOptions) => Promise<boolean>;
  alert: (opts: ModalOptions) => Promise<void>;
}

const ModalContext = createContext<ModalApi | null>(null);

export function useModal(): ModalApi {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal 必须在 <ModalProvider> 内使用');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PendingModal | null>(null);
  const queueRef = useRef<PendingModal[]>([]);

  const settle = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
    return next;
  }, []);

  const confirm = useCallback(
    (opts: ModalOptions): Promise<boolean> =>
      new Promise((resolve) => {
        queueRef.current.push({ kind: 'confirm', opts, resolve });
        if (!current) settle();
      }),
    [current, settle]
  );

  const alert = useCallback(
    (opts: ModalOptions): Promise<void> =>
      new Promise((resolve) => {
        queueRef.current.push({ kind: 'alert', opts, resolve: () => resolve() });
        if (!current) settle();
      }),
    [current, settle]
  );

  function close(result: boolean) {
    current?.resolve(result);
    settle();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') close(false);
  }

  if (!current) {
    return <ModalContext.Provider value={{ confirm, alert }}>{children}</ModalContext.Provider>;
  }

  const isConfirm = current.kind === 'confirm';
  const { opts } = current;

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      <div className="modal-overlay" role="presentation" onMouseDown={() => close(false)}>
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h3 id="modal-title" className="modal-title">
            {opts.title}
          </h3>
          {opts.message !== undefined && <div className="modal-message">{opts.message}</div>}
          <div className="modal-actions">
            {isConfirm && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => close(false)} autoFocus>
                {opts.cancelText ?? '取消'}
              </button>
            )}
            <button
              type="button"
              className={opts.danger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
              onClick={() => close(true)}
            >
              {opts.confirmText ?? (isConfirm ? '确定' : '知道了')}
            </button>
          </div>
        </div>
      </div>
    </ModalContext.Provider>
  );
}
