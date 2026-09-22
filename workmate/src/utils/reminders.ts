// 将截止临近提醒的分钟数转换为统一的中文显示文案。
// 保留分钟数作为内部存储单位，便于兼容已有计划设置。
export function formatNearDueReminder(minutes: number): string {
  const safeMinutes = minutes > 0 ? minutes : 60;
  if (safeMinutes < 60) return `截止前${safeMinutes}分钟`;
  return `截止前${safeMinutes / 60}小时`;
}
