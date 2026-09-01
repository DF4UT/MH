/**
 * md-editor-v3 类型桥接
 * 说明：md-editor-v3 5.x 的 .d.ts 混入了 Vue 的 DefineComponent 类型，
 * 与 next/dynamic 及 React 类型不兼容。此处定义最小 React 属性接口，
 * 运行时组件本身是 React 实现，仅类型层面桥接。
 */
import type { ComponentType, CSSProperties } from 'react';

export interface MdEditorProps {
  modelValue: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
  language?: string;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  previewTheme?: string;
  codeTheme?: string;
  noPrettier?: boolean;
  readOnly?: boolean;
}

export interface MdPreviewProps {
  modelValue: string;
  theme?: 'light' | 'dark';
  language?: string;
  previewTheme?: string;
  codeTheme?: string;
  className?: string;
  style?: CSSProperties;
}

export type MdEditorComponent = ComponentType<MdEditorProps>;
export type MdPreviewComponent = ComponentType<MdPreviewProps>;
