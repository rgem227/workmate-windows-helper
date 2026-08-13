// 声音播放工具
import { invoke } from '@tauri-apps/api/core';

export async function playSound(customFile?: string): Promise<void> {
  try {
    if (customFile) {
      // 使用自定义文件播放声音
      await invoke('play_sound', { filePath: customFile });
    } else {
      // 使用系统默认提示音
      await invoke('play_default_sound');
    }
  } catch (e) {
    console.error('播放声音失败:', e);
  }
}

export async function playSuccessSound(): Promise<void> {
  try {
    await invoke('play_success_sound');
  } catch (e) {
    console.error('播放成功提示音失败:', e);
  }
}
