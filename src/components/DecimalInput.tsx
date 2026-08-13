import { useState, useRef, useEffect } from 'react';

interface DecimalInputProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  ariaLabel?: string;
}

/**
 * 数字输入框：输入期间保留原始字符串草稿，
 * 修复 "type=number" 无法直接输入 0.12 / .12 的问题。
 */
export default function DecimalInput({
  value,
  onValueChange,
  min,
  max,
  className = '',
  placeholder,
  inputMode = 'decimal',
  ariaLabel,
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const focusValueRef = useRef(value);

  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const handleFocus = () => {
    setFocused(true);
    setDraft(String(value));
    focusValueRef.current = value;
  };

  const handleChange = (raw: string) => {
    if (!/^\d*\.?\d*$/.test(raw)) return;
    let next = raw;
    // ".12" → "0.12"，避免显示 .12
    if (next.startsWith('.')) next = '0' + next;
    setDraft(next);
    if (next === '') {
      onValueChange(0);
      return;
    }
    const parsed = parseFloat(next);
    if (!Number.isNaN(parsed)) onValueChange(parsed);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (draft === '' || Number.isNaN(parsed)) {
      // 清空后失焦：还原为编辑前的值
      onValueChange(focusValueRef.current);
      setDraft(String(focusValueRef.current));
    } else {
      const clamped = clamp(parsed);
      onValueChange(clamped);
      setDraft(String(clamped));
    }
  };

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={focused ? draft : String(value)}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => {
        handleFocus();
        e.target.select();
      }}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      aria-label={ariaLabel}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
