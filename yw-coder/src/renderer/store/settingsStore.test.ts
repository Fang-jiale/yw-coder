import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useSettingsStore.setState({
      theme: 'light',
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      tabSize: 2,
      wordWrap: true,
      minimap: true,
    });
  });

  it('should have default values', () => {
    const settings = useSettingsStore.getState();
    expect(settings.theme).toBe('light');
    expect(settings.fontSize).toBe(14);
    expect(settings.tabSize).toBe(2);
  });

  it('should update theme', () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('should update font size', () => {
    useSettingsStore.getState().setFontSize(16);
    expect(useSettingsStore.getState().fontSize).toBe(16);
  });

  it('should update word wrap', () => {
    useSettingsStore.getState().setWordWrap(false);
    expect(useSettingsStore.getState().wordWrap).toBe(false);
  });

  it('should update tab size', () => {
    useSettingsStore.getState().setTabSize(4);
    expect(useSettingsStore.getState().tabSize).toBe(4);
  });

  it('should update minimap', () => {
    useSettingsStore.getState().setMinimap(false);
    expect(useSettingsStore.getState().minimap).toBe(false);
  });
});
