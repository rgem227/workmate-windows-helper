// CSS 激励动效组件库
// 撒花 / 烟花 / 星星旋转 / 气泡上升 / 奖杯闪耀 / 彩虹 / 比心 / 火箭
import { useState } from 'react';

// ---- 工具：生成随机粒子 ----
interface Particle {
  id: number;
  x: number;      // 水平起始位置 (%)
  delay: number;   // 动画延迟 (s)
  duration: number; // 动画时长 (s)
  size: number;    // 粒子大小 (px)
  color: string;   // 颜色
  rotation: number; // 旋转角度
}

const COLORS = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#F97316','#06B6D4'];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand(5, 95),
    delay: rand(0, 0.8),
    duration: rand(1.5, 3),
    size: rand(6, 14),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: rand(0, 360),
  }));
}

// ==================== 撒花 Confetti ====================
export function ConfettiAnim() {
  const [particles] = useState(() => generateParticles(40));
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map(p => (
        <div key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ==================== 烟花 Fireworks ====================
export function FireworksAnim() {
  const [bursts] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: rand(20, 80),
      y: rand(20, 60),
      delay: rand(0, 1.2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
  );
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute"
          style={{ left: `${b.x}%`, top: `${b.y}%`, animation: `firework-pop 1.5s ease-out ${b.delay}s forwards` }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: b.color,
                animation: `firework-particle 1.5s ease-out ${b.delay}s forwards`,
                transform: `rotate(${i * 30}deg) translateY(-60px)`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ==================== 星星旋转 StarRotate ====================
export function StarRotateAnim() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      <div className="relative w-48 h-48 animate-spin-slow">
        {['⭐','🌟','✨','💫','⭐','🌟'].map((star, i) => {
          const angle = (i * 60) * Math.PI / 180;
          const r = 80;
          const cx = Math.cos(angle) * r;
          const cy = Math.sin(angle) * r;
          return (
            <span key={i} className="absolute text-3xl"
              style={{
                left: `calc(50% + ${cx}px)`,
                top: `calc(50% + ${cy}px)`,
                transform: 'translate(-50%, -50%)',
                animation: `star-pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
              }}
            >{star}</span>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 气泡上升 Bubbles ====================
export function BubblesAnim() {
  const [bubbles] = useState(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: rand(10, 90),
      size: rand(16, 40),
      delay: rand(0, 2),
      duration: rand(2, 4),
    }))
  );
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {bubbles.map(b => (
        <div key={b.id} className="absolute rounded-full border-2 border-white/30"
          style={{
            left: `${b.x}%`, bottom: '-40px',
            width: `${b.size}px`, height: `${b.size}px`,
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), rgba(100,180,255,0.15))',
            animation: `bubble-rise ${b.duration}s ease-in ${b.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ==================== 奖杯闪耀 Trophy ====================
export function TrophyAnim() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      <div className="relative">
        <div className="text-8xl animate-trophy-bounce select-none">🏆</div>
        <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-xl animate-trophy-glow" />
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-yellow-300/40 rounded-full blur-md animate-trophy-glow" />
      </div>
    </div>
  );
}

// ==================== 彩虹 Rainbow ====================
export function RainbowAnim() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-end justify-center overflow-hidden">
      <div className="w-[120vw] h-[60vh] animate-rainbow-rise"
        style={{
          background: `
            radial-gradient(ellipse 80% 100% at 50% 100%,
              transparent 40%,
              #EF444440 45%, #F59E0B40 50%, #FBBF2440 55%,
              #10B98140 60%, #3B82F640 65%, #8B5CF640 70%,
              #EC489940 75%, transparent 80%
            )`,
        }}
      />
    </div>
  );
}

// ==================== 比心 HeartBeat ====================
export function HeartBeatAnim() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      <div className="animate-heart-beat text-8xl select-none">💖</div>
    </div>
  );
}

// ==================== 火箭升空 Rocket ====================
export function RocketAnim() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <div className="absolute left-1/2 -translate-x-1/2 animate-rocket-launch select-none"
        style={{ bottom: '-60px' }}>
        <span className="text-7xl block">🚀</span>
        <div className="flex justify-center gap-1 -mt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-3 h-3 rounded-full bg-orange-400/60 blur-sm"
              style={{ animation: `smoke-puff 0.4s ease-out ${i * 0.08}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== 动画类型映射 ====================
export type AnimType = 'confetti' | 'fireworks' | 'star_rotate' | 'bubbles' | 'trophy' | 'rainbow' | 'heart_beat' | 'rocket';

const ANIM_COMPONENTS: Record<AnimType, React.FC> = {
  confetti: ConfettiAnim,
  fireworks: FireworksAnim,
  star_rotate: StarRotateAnim,
  bubbles: BubblesAnim,
  trophy: TrophyAnim,
  rainbow: RainbowAnim,
  heart_beat: HeartBeatAnim,
  rocket: RocketAnim,
};

const SUCCESS_ANIMS: AnimType[] = ['confetti', 'fireworks', 'star_rotate', 'bubbles', 'trophy', 'rainbow', 'heart_beat', 'rocket'];
const OVERDUE_ANIMS: AnimType[] = ['bubbles', 'rainbow', 'star_rotate', 'heart_beat'];

export function getRandomAnim(type: 'success' | 'overdue'): AnimType {
  const pool = type === 'success' ? SUCCESS_ANIMS : OVERDUE_ANIMS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function renderAnimComponent(animType: AnimType): React.ReactNode {
  const Comp = ANIM_COMPONENTS[animType];
  return Comp ? <Comp /> : <ConfettiAnim />;
}
