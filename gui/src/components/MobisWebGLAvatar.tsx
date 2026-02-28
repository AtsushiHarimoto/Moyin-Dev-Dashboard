import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysisStore } from '../stores/useAnalysisStore';

// --- Brand Colors ---
const COLORS = {
  sakura: '#ffc0d3',
  success: '#a8e6cf',
  error: '#ff8b94',
  loading: '#c3b1e1',
};

type AvatarStatus = 'idle' | 'loading' | 'error' | 'success';

const STATUS_CONFIG: Record<AvatarStatus, {
  text: string;
  glowColor: string;
  glowOpacity: number;
  breathSpeed: number;
  pulseScale: number;
}> = {
  idle: {
    text: 'Master, fighting! ✨',
    glowColor: COLORS.sakura,
    glowOpacity: 0.3,
    breathSpeed: 4,
    pulseScale: 1,
  },
  loading: {
    text: '分析中…請稍候 🔍',
    glowColor: COLORS.loading,
    glowOpacity: 0.5,
    breathSpeed: 1.5,
    pulseScale: 1.02,
  },
  error: {
    text: '出錯了…再試一次？😢',
    glowColor: COLORS.error,
    glowOpacity: 0.6,
    breathSpeed: 2,
    pulseScale: 0.98,
  },
  success: {
    text: '完成啦！辛苦了～ 🎉',
    glowColor: COLORS.success,
    glowOpacity: 0.5,
    breathSpeed: 3,
    pulseScale: 1.03,
  },
};

function useAvatarStatus(): AvatarStatus {
  const job = useAnalysisStore((s) => s.currentJob);
  if (!job) return 'idle';
  const st = job.status;
  if (st === 'completed') return 'success';
  if (st === 'failed' || st === 'cancelled') return 'error';
  return 'loading';
}

// --- Image pools ---
const IDLE_IMAGES = ['/mobis_avatar.png', '/mobis_avatar_2.png', '/mobis_avatar_3.png'];
const LOADING_IMAGE = '/mobis_avatar_loading.png';
const IDLE_ROTATE_MS = 18_000; // rotate every 18s

function pickRandom(pool: string[], exclude?: string): string {
  const candidates = exclude ? pool.filter(p => p !== exclude) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
}

function useAvatarImage(status: AvatarStatus): string {
  const [img, setImg] = useState(() => pickRandom(IDLE_IMAGES));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rotate = useCallback(() => {
    setImg(prev => pickRandom(IDLE_IMAGES, prev));
  }, []);

  useEffect(() => {
    if (status === 'loading') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    // Start rotation for non-loading states
    timerRef.current = setInterval(rotate, IDLE_ROTATE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, rotate]);

  if (status === 'loading') return LOADING_IMAGE;
  return img;
}

const PARTICLES = Array.from({ length: 15 }, () => ({
  w: Math.random() * 6 + 2,
  h: Math.random() * 6 + 2,
  left: Math.random() * 100,
  glow: Math.random() * 10 + 5,
  xStart: (Math.random() - 0.5) * 50,
  xEnd: (Math.random() - 0.5) * 100,
  dur: Math.random() * 5 + 3,
  delay: Math.random() * 5,
}));

export const MobisWebGLAvatar: React.FC = () => {
  const status = useAvatarStatus();
  const cfg = STATUS_CONFIG[status];
  const avatarSrc = useAvatarImage(status);

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-[9999] pointer-events-auto w-64 h-80 flex items-end justify-center cursor-grab active:cursor-grabbing"
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.05 }}
    >
      {/* 櫻花花瓣粒子 */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none rounded-full"
        style={{ maskImage: 'radial-gradient(circle, black, transparent 70%)' }}
      >
        {PARTICLES.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.w + 'px',
              height: p.h + 'px',
              backgroundColor: cfg.glowColor,
              boxShadow: `0 0 ${p.glow}px ${cfg.glowColor}`,
              left: p.left + '%',
              top: '-10%',
            }}
            animate={{
              y: ['0vh', '40vh'],
              x: [p.xStart, p.xEnd],
              opacity: [0, 0.8, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: p.dur,
              repeat: Infinity,
              ease: 'linear',
              delay: p.delay,
            }}
          />
        ))}
      </div>

      {/* 角色本身 */}
      <motion.div
        className="relative w-full h-full flex flex-col items-center justify-end pointer-events-auto group"
        animate={{
          y: [-5, 5, -5],
          scale: [1, cfg.pulseScale, 1],
        }}
        transition={{
          duration: cfg.breathSpeed,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* 背景光暈 — 顏色隨狀態變化 */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full mix-blend-screen filter blur-[40px] group-hover:opacity-60 transition-opacity duration-1000"
          animate={{ backgroundColor: cfg.glowColor, opacity: cfg.glowOpacity }}
          transition={{ duration: 0.8 }}
        />

        {/* 對話框 — 狀態文字 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute -top-12 right-4 bg-white/10 backdrop-blur-md border border-[#ffc0d3]/30 px-4 py-2 rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(255,192,211,0.2)] text-sm font-medium tracking-wide whitespace-nowrap"
            style={{ color: cfg.glowColor }}
          >
            {cfg.text}
          </motion.div>
        </AnimatePresence>

        {/* 角色圖片 — crossfade on src change */}
        <AnimatePresence mode="wait">
          <motion.img
            key={avatarSrc}
            src={avatarSrc}
            alt="Mobis Avatar"
            className="w-full h-full object-contain object-bottom drop-shadow-[0_0_15px_rgba(255,192,211,0.3)] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              filter: status === 'error'
                ? ['brightness(1)', 'brightness(0.85)', 'brightness(1)']
                : 'brightness(1)',
            }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.6 }, filter: { duration: 1.5, repeat: status === 'error' ? Infinity : 0 } }}
          />
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
