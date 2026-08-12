export type CrosshairStyle = 'cross' | 'dot' | 'chevron';

export interface CrosshairSettings {
  style: CrosshairStyle;
  color: string;
  thickness: number;
  gap: number;
  size: number;
  opacity: number;
}
