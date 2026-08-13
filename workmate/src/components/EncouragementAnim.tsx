// 激励动画组件 v2
// 优先级：节假日 > 季节 > 常规
// 模式：仅文字 / 仅动画 / 混合（根据设置）
// 动画来源：CSS 动效 > emoji > 纯文字
import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import { getHoliday, getSeason } from '../utils/holidays';
import { getRandomAnim, renderAnimComponent } from './AnimEffects';
import type { AnimType } from './AnimEffects';

// ---- 常规文字/emoji ----
const REGULAR = {
  success: {
    emojis: ['🎉','🎊','🏆','⭐','🌟','✨','🎯','💫','🔥','🚀','🌈','🍀','💪','👍','💯','🎈','🎁','💎','🦄','🐥'],
    texts: [
      '✨ 完成了！继续加油！','🌟 今日份努力，已收入囊中！','💪 搞定！你真行！',
      '🎊 撒花撒花！为今天的你鼓掌！','👍 干得漂亮！','🚀 任务完成，火箭升空！',
      '🌈 彩虹为你喝彩！','🍀 好棒！幸运与你同行！','🔥 火力全开！无人能挡！',
      '⭐ 你是最亮的星！','🎯 一击即中！完美完成！','💫 闪闪发光！今天因你而精彩！',
    ],
  },
  overdue: {
    emojis: ['🌱','🌻','☀️','🌤️','💧','🌿','🤗','💪','🔄','💖','⏰','🦋','🏔️','🌙','☕'],
    texts: [
      '😢 任务延期了，不过没关系，重新开始吧！','💪 别灰心！重新规划吧！',
      '🌱 今天又是新的一天，继续努力！','🤗 没关系的，慢慢来，加油！',
      '☀️ 阳光总在风雨后','🌈 延期不可怕，可怕的是放弃',
      '💧 下过雨的土地，更适合播种','🤝 没关系，我陪你一起加油！',
      '🌻 向日葵永远向着阳光，你也加油！','🔄 重新开始，就是最好的开始',
    ],
  },
};

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export default function EncouragementAnim() {
  const { animation, hideAnimation, settings } = useStore();
  const [visible, setVisible] = useState(false);

  const holiday = useMemo(() => getHoliday(), []);
  const season = useMemo(() => getSeason(), []);

  // 随机选择动画类型（仅在 visible 切换时重新随机）
  const [animType] = useState<AnimType>(() =>
    animation.type === 'success' ? getRandomAnim('success') : getRandomAnim('overdue')
  );

  useEffect(() => {
    if (animation.show && settings.animation_enabled !== 'false') {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        hideAnimation();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [animation.show, settings.animation_enabled]);

  if (!visible || settings.animation_enabled === 'false') return null;

  const isSuccess = animation.type === 'success';
  const preference = settings.animation_preference || 'mixed';

  // 选择文案（节假日 > 季节 > 常规）
  const message = animation.message || (() => {
    if (holiday) {
      const pool = isSuccess ? holiday.successTexts : holiday.overdueTexts;
      return pickRandom(pool);
    }
    if (season) {
      const pool = isSuccess ? season.successTexts : season.overdueTexts;
      return pickRandom(pool);
    }
    return pickRandom(isSuccess ? REGULAR.success.texts : REGULAR.overdue.texts);
  })();

  // 选择 emoji（节假日 > 季节 > 常规）
  const emoji = (() => {
    if (holiday) {
      const pool = isSuccess ? holiday.successAnimations : holiday.overdueAnimations;
      return pickRandom(pool);
    }
    if (season) {
      const pool = isSuccess ? season.successAnimations : season.overdueAnimations;
      return pickRandom(pool);
    }
    return pickRandom(isSuccess ? REGULAR.success.emojis : REGULAR.overdue.emojis);
  })();

  return (
    <>
      {/* CSS 动效（仅"仅动画"和"混合"模式显示） */}
      {preference !== 'text' && renderAnimComponent(animType)}

      {/* 文字 + emoji 覆盖层 */}
      {preference !== 'animation' && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
          <div className="text-center px-4">
            {holiday && <div className="text-sm text-gray-500 mb-2">{holiday.emoji} {holiday.name}专属</div>}
            {!holiday && <div className="text-sm text-gray-400 mb-2">{season.emoji} {season.name}限定</div>}
            <p className={`text-xl sm:text-3xl font-bold drop-shadow-lg mb-3 select-none ${
              isSuccess ? 'text-green-500' : 'text-yellow-500'
            }`}>
              {message}
            </p>
            <div className="text-6xl sm:text-8xl animate-bounce select-none">{emoji}</div>
          </div>
        </div>
      )}
    </>
  );
}
