// 节假日与季节检测工具
// 用于：激励动画切换、节假日顺延提醒

export interface HolidayInfo {
  name: string;        // 节日名称
  emoji: string;       // 节日 emoji
  // 完成动画（各 5 款）
  successAnimations: string[];
  successTexts: string[];
  // 安慰动画（各 5 款）
  overdueAnimations: string[];
  overdueTexts: string[];
}

export interface SeasonInfo {
  name: string;
  emoji: string;
  successAnimations: string[];
  successTexts: string[];
  overdueAnimations: string[];
  overdueTexts: string[];
}

// ====== 节日定义（公历日期 + 农历估算） ======
// 农历节日每年日期不同，此处使用近似公历日期
const HOLIDAYS: Record<string, HolidayInfo> = {
  '01-01': {
    name: '元旦', emoji: '🎆',
    successAnimations: ['🎆', '🎊', '🎉', '⭐', '🎈'],
    successTexts: ['新年新气象，继续加油！', '🎊 元旦快乐！新的一年继续努力！', '🎉 新的一年，新的开始！', '✨ 元旦快乐，万事如意！', '🌟 新年第一天，元气满满！'],
    overdueAnimations: ['🎆', '🎊', '⭐', '🎉', '🎈'],
    overdueTexts: ['新的一年，新的开始！', '🎊 元旦也要加油哦！', '🌟 新年不气馁！', '✨ 重新出发！', '🎈 新的一年，重新规划！'],
  },
  '02-14': {
    name: '情人节', emoji: '💕',
    successAnimations: ['💕', '🌹', '🍫', '🎈', '💌'],
    successTexts: ['💕 爱你所爱，继续加油！', '🌹 浪漫的日子也要努力工作！', '🍫 甜甜的完成，甜甜的你！', '💌 心中有爱，眼中有光！', '🎈 为爱努力！'],
    overdueAnimations: ['💕', '🌹', '💌', '🍫', '🎈'],
    overdueTexts: ['💕 没关系，爱还在！', '🌹 延期也是一种浪漫！', '💌 慢慢来，不着急！', '🍫 给自己一点甜！', '🎈 爱自己，重新开始！'],
  },
  '03-08': {
    name: '妇女节', emoji: '🌸',
    successAnimations: ['🌸', '🌷', '💐', '✨', '👑'],
    successTexts: ['🌸 女神节快乐！', '🌷 致敬每一个努力的你！', '💐 今天你最美！', '👑 做自己的女王！', '✨ 闪闪发光的你！'],
    overdueAnimations: ['🌸', '🌷', '💐', '✨', '👑'],
    overdueTexts: ['🌸 女神也要休息一下！', '🌷 辛苦了，慢慢来！', '💐 你已经很棒了！', '👑 女王也有调整的时候！', '✨ 休息是为了更好的出发！'],
  },
  '05-01': {
    name: '劳动节', emoji: '🏆',
    successAnimations: ['🔧', '🏆', '⭐', '🎉', '🌟'],
    successTexts: ['🏆 劳动最光荣！', '🔧 致敬每一个努力的你！', '⭐ 辛勤的付出终有回报！', '🌟 劳动者的荣耀！', '🎉 节日快乐，继续奋斗！'],
    overdueAnimations: ['🔧', '🏆', '⭐', '🌟', '🎉'],
    overdueTexts: ['🔧 劳动者也需要休息！', '🏆 调整节奏，继续前进！', '⭐ 辛苦的你值得一个假期！', '🌟 劳逸结合，重新出发！', '🎉 节日放松一下！'],
  },
  '06-01': {
    name: '儿童节', emoji: '🎠',
    successAnimations: ['🎠', '🎪', '🎨', '🧸', '🍭'],
    successTexts: ['🎠 保持童心，继续前进！', '🎪 像孩子一样快乐完成！', '🎨 今天也是个宝宝！', '🧸 童心未泯，干劲十足！', '🍭 甜甜的完成！'],
    overdueAnimations: ['🎠', '🎪', '🧸', '🎨', '🍭'],
    overdueTexts: ['🎠 孩子气地重新开始！', '🎪 没关系，玩一玩再继续！', '🧸 抱抱自己，没关系！', '🎨 画一个新的开始！', '🍭 给自己一颗糖！'],
  },
  '10-01': {
    name: '国庆节', emoji: '🇨🇳',
    successAnimations: ['🎊', '🎈', '🏮', '⭐', '🎆'],
    successTexts: ['🇨🇳 祝祖国生日快乐！', '🎊 国庆快乐，继续奋斗！', '🎈 为梦想努力，为祖国加油！', '⭐ 辉煌中国，奋斗有我！', '🎆 与国同庆，继续前进！'],
    overdueAnimations: ['🎊', '🏮', '🎈', '⭐', '🎆'],
    overdueTexts: ['🇨🇳 国庆也要加油！', '🎊 假期后重新出发！', '🏮 红旗下的奋斗者！', '⭐ 为国努力，也为自己！', '🎆 休息好了再继续！'],
  },
  '12-25': {
    name: '圣诞节', emoji: '🎄',
    successAnimations: ['🎄', '🎅', '❄️', '🎁', '🦌'],
    successTexts: ['🎄 圣诞快乐！继续加油！', '🎅 圣诞老人也为你的努力点赞！', '🎁 最好的礼物是你的坚持！', '❄️ 白色圣诞，美好完成！', '🦌 驯鹿带你飞向目标！'],
    overdueAnimations: ['🎄', '🎅', '❄️', '🎁', '🦌'],
    overdueTexts: ['🎄 圣诞快乐，别太累了！', '🎅 圣诞老人说休息一下没关系！', '🎁 给自己一个拥抱！', '❄️ 雪花飘落，重新开始！', '🦌 慢慢来，礼物会有的！'],
  },
};

// 农历节日估算（按 2025 年日期，±2 天容差）
// 春节 ≈ 1月29日, 元宵 ≈ 2月12日, 端午 ≈ 5月31日, 中秋 ≈ 10月6日
const LUNAR_ESTIMATES: { mmdd: string; name: string; holiday: HolidayInfo }[] = [
  {
    mmdd: '01-29', name: '春节', holiday: {
      name: '春节', emoji: '🧧',
      successAnimations: ['🏮', '🧧', '🐲', '🎆', '🧨'],
      successTexts: ['🧧 春节快乐！新年新目标，继续冲！', '🐉 新年到，好运来！', '🏮 红红火火，干劲十足！', '🎆 新春大吉，万事如意！', '🧨 鞭炮声声，事业蒸蒸日上！'],
      overdueAnimations: ['🏮', '🧧', '🐲', '🎆', '🧨'],
      overdueTexts: ['🧧 过年啦，别太累！', '🏮 新年新开始，重新规划！', '🐉 龙年大吉，慢慢来！', '🎆 春节快乐，调整节奏！', '🧨 辞旧迎新，重新出发！'],
    },
  },
  {
    mmdd: '02-12', name: '元宵节', holiday: {
      name: '元宵节', emoji: '🏮',
      successAnimations: ['🏮', '🥟', '🐰', '🌕', '🎆'],
      successTexts: ['🏮 元宵节快乐！团团圆圆！', '🥟 汤圆甜甜，完成满满！', '🌕 月圆人团圆，任务也圆满！', '🐰 玉兔送福，继续加油！', '🎆 花灯璀璨，继续努力！'],
      overdueAnimations: ['🏮', '🥟', '🌕', '🐰', '🎆'],
      overdueTexts: ['🏮 元宵快乐，歇一歇！', '🥟 吃碗汤圆再继续！', '🌕 月圆之时，重新出发！', '🐰 兔子陪你慢慢来！', '🎆 灯火温暖，不必着急！'],
    },
  },
  {
    mmdd: '05-31', name: '端午节', holiday: {
      name: '端午节', emoji: '🐉',
      successAnimations: ['🐉', '🍙', '🎋', '🌊', '🐟'],
      successTexts: ['🐉 端午安康！龙舟精神，奋勇向前！', '🍙 粽香时节，继续加油！', '🎋 艾草飘香，干劲十足！', '🌊 乘风破浪，勇往直前！', '🐟 如鱼得水，任务完成！'],
      overdueAnimations: ['🐉', '🍙', '🎋', '🌊', '🐟'],
      overdueTexts: ['🐉 端午安康，别太拼！', '🍙 吃个粽子，补充能量！', '🎋 艾草祈福，重新开始！', '🌊 浪花过后，重新出发！', '🐟 像鱼儿一样自在！'],
    },
  },
  {
    mmdd: '10-06', name: '中秋节', holiday: {
      name: '中秋节', emoji: '🌕',
      successAnimations: ['🌕', '🐇', '🥮', '⭐', '🏮'],
      successTexts: ['🌕 中秋快乐！月圆人团圆！', '🥮 月饼甜甜，完成满满！', '🐇 玉兔捣药，坚持不懈！', '⭐ 月明星稀，继续努力！', '🏮 花好月圆，事事圆满！'],
      overdueAnimations: ['🌕', '🐇', '🥮', '⭐', '🏮'],
      overdueTexts: ['🌕 中秋快乐，休息一下！', '🥮 吃块月饼再继续！', '🐇 玉兔陪你慢慢来！', '⭐ 月圆之夜，重新许愿！', '🏮 明月寄相思，不必急于一时！'],
    },
  },
];

// ====== 季节定义 ======
const SEASONS: Record<string, SeasonInfo> = {
  spring: {
    name: '春季', emoji: '🌸',
    successAnimations: ['🌸', '🦋', '🌷', '🐣', '🐝'],
    successTexts: ['🌸 春天来了，万物复苏！', '🦋 春暖花开，继续加油！', '🌷 春风十里不如努力的你！', '🐣 新生力量，势不可挡！', '🐝 像蜜蜂一样勤劳！'],
    overdueAnimations: ['🌸', '🦋', '🌷', '🐣', '🐝'],
    overdueTexts: ['🌸 春暖花开，重新开始！', '🦋 破茧成蝶需要时间！', '🌷 春天的花朵为你绽放！', '🐣 新的生机，新的开始！', '🐝 慢慢来，春天很长！'],
  },
  summer: {
    name: '夏季', emoji: '☀️',
    successAnimations: ['🍉', '🍦', '🏖️', '🏊', '✨'],
    successTexts: ['☀️ 夏日炎炎，继续努力！', '🍉 像西瓜一样甜美完成！', '🍦 酷爽一夏，干劲十足！', '🏖️ 阳光沙滩，效率爆表！', '🏊 乘风破浪，勇往直前！'],
    overdueAnimations: ['🍉', '🍦', '🏖️', '🏊', '✨'],
    overdueTexts: ['☀️ 夏日炎炎，休息一下！', '🍉 吃块西瓜消消暑！', '🍦 凉爽一下再继续！', '🏖️ 夏天很长，不必着急！', '✨ 萤火虫为你点亮前路！'],
  },
  autumn: {
    name: '秋季', emoji: '🍂',
    successAnimations: ['🍂', '🎃', '🌾', '🦔', '🌙'],
    successTexts: ['🍂 秋高气爽，收获的季节！', '🌾 辛勤耕耘，终于收获！', '🎃 秋天的果实属于努力的你！', '🦔 像松鼠一样勤劳储备！', '🌙 秋月明，任务清！'],
    overdueAnimations: ['🍂', '🎃', '🌾', '🦔', '🌙'],
    overdueTexts: ['🍂 秋叶飘落，重新开始！', '🌾 收获需要等待！', '🎃 秋天的南瓜也在慢慢长大！', '🦔 慢慢积蓄，厚积薄发！', '🌙 秋月伴你，重新出发！'],
  },
  winter: {
    name: '冬季', emoji: '❄️',
    successAnimations: ['❄️', '⛄', '🧣', '☕', '🔥'],
    successTexts: ['❄️ 冬日可爱，继续前行！', '⛄ 像雪人一样坚定完成！', '🧣 温暖的完成，暖心暖身！', '☕ 热咖啡般的成就感！', '🔥 寒冬里的奋斗之火！'],
    overdueAnimations: ['❄️', '⛄', '🧣', '☕', '🔥'],
    overdueTexts: ['❄️ 冬日可爱，别太苛责自己！', '⛄ 雪人陪你慢慢来！', '🧣 围着围巾休息一下！', '☕ 喝杯热可可，暖暖心！', '🔥 壁炉旁的温暖重启！'],
  },
};

// ====== 检测函数 ======

/** 获取当前日期对应的节日（公历 + 农历估算，±2天容差） */
export function getHoliday(date: Date = new Date()): HolidayInfo | null {
  const mmdd = formatMMDD(date);

  // 精确匹配公历节日
  if (HOLIDAYS[mmdd]) return HOLIDAYS[mmdd];

  // 农历估算（±2天容差）
  for (const lunar of LUNAR_ESTIMATES) {
    const lunarDate = parseMMDD(lunar.mmdd, date.getFullYear());
    const diff = Math.abs(date.getTime() - lunarDate.getTime()) / 86400000;
    if (diff <= 2) return lunar.holiday;
  }

  return null;
}

/** 获取当前季节 */
export function getSeason(date: Date = new Date()): SeasonInfo {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return SEASONS.spring;
  if (m >= 6 && m <= 8) return SEASONS.summer;
  if (m >= 9 && m <= 11) return SEASONS.autumn;
  return SEASONS.winter;
}

/** 判断是否为工作日（周一至周五，不含节假日） */
export function isWorkday(date: Date = new Date()): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  // 简化处理：公历节日视为非工作日
  const mmdd = formatMMDD(date);
  if (HOLIDAYS[mmdd]) return false;
  return true;
}

/** 获取下一个工作日（跳过周末和公历节日） */
export function getNextWorkday(date: Date = new Date()): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isWorkday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/** 判断是否为节假日或周末（非工作日） */
export function isHolidayOrWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  const mmdd = formatMMDD(date);
  if (HOLIDAYS[mmdd]) return true;
  // 农历节日估算（±2天）
  for (const lunar of LUNAR_ESTIMATES) {
    const lunarDate = parseMMDD(lunar.mmdd, date.getFullYear());
    const diff = Math.abs(date.getTime() - lunarDate.getTime()) / 86400000;
    if (diff <= 2) return true;
  }
  return false;
}

/** 获取 N 个工作日之前的日期（自动跳过周末和节假日） */
export function getWorkdaysBefore(fromDate: Date, workdays: number): Date {
  const result = new Date(fromDate);
  let counted = 0;
  // 从前一天开始往前数
  result.setDate(result.getDate() - 1);
  while (counted < workdays) {
    if (isWorkday(result)) {
      counted++;
      if (counted < workdays) {
        result.setDate(result.getDate() - 1);
      }
    } else {
      result.setDate(result.getDate() - 1);
    }
  }
  // 确保最终日期也是工作日
  while (!isWorkday(result)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

// ====== 辅助函数 ======

function formatMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function parseMMDD(mmdd: string, year: number): Date {
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(year, m - 1, d);
}
