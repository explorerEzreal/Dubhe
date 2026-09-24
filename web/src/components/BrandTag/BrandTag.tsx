import {
  AnthropicFilled,
  BaiduOutlined,
  DeepSeekFilled,
  GeminiFilled,
  MetaFilled,
  MistralFilled,
  OpenAIFilled,
  QwenFilled,
  RobotOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import type { TagProps } from 'antd';
import type { ReactNode } from 'react';
import './BrandTag.less';

export type BrandTagKnownBrand =
  | 'openai'
  | 'anthropic'
  | 'claude'
  | 'deepseek'
  | 'gemini'
  | 'glm'
  | 'qwen'
  | 'mistral'
  | 'meta'
  | 'baidu';

export type BrandTagBrand = BrandTagKnownBrand | (string & {});

export type BrandTagProps = Omit<TagProps, 'color' | 'icon'> & {
  brand: BrandTagBrand;
  color?: TagProps['color'];
  icon?: ReactNode;
};

type BrandDefinition = {
  color: NonNullable<TagProps['color']>;
  icon: ReactNode;
};

const brandDefinitions: Record<BrandTagKnownBrand, BrandDefinition> = {
  openai: { color: 'green', icon: <OpenAIFilled /> },
  anthropic: { color: 'orange', icon: <AnthropicFilled /> },
  claude: { color: 'orange', icon: <AnthropicFilled /> },
  deepseek: { color: 'blue', icon: <DeepSeekFilled /> },
  gemini: { color: 'geekblue', icon: <GeminiFilled /> },
  glm: { color: 'cyan', icon: <RobotOutlined /> },
  qwen: { color: 'gold', icon: <QwenFilled /> },
  mistral: { color: 'volcano', icon: <MistralFilled /> },
  meta: { color: 'geekblue', icon: <MetaFilled /> },
  baidu: { color: 'blue', icon: <BaiduOutlined /> },
};

const fallbackDefinition: BrandDefinition = {
  color: 'default',
  icon: <RobotOutlined />,
};

export function BrandTag({ brand, color, icon, className, ...props }: BrandTagProps): JSX.Element {
  const definition = Object.prototype.hasOwnProperty.call(brandDefinitions, brand)
    ? brandDefinitions[brand as BrandTagKnownBrand]
    : fallbackDefinition;

  return (
    <Tag
      {...props}
      className={`brand-tag${className ? ` ${className}` : ''}`}
      color={color ?? definition.color}
      icon={icon ?? definition.icon}
    />
  );
}
