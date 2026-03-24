/**
 * 动画效果工具函数
 * 提供统一的动画控制
 */

export const animations = {
  // 光标闪烁动画
  'cursor-blink': {
    '0%, 50%': { opacity: '1' },
    '51%, 100%': { opacity: '0' },
  },

  // 消息淡入动画
  'message-fade-in': {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },

  // 消息滑入动画
  'message-slide-in': {
    '0%': { opacity: '0', transform: 'translateY(10px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },

  // 打字机内容更新动画
  'typewriter-update': {
    '0%': { opacity: '0.7' },
    '50%': { opacity: '1' },
    '100%': { opacity: '0.7' },
  },

  // 流式状态指示器脉冲动画
  'streaming-pulse': {
    '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
    '50%': { opacity: '1', transform: 'scale(1.1)' },
  },

  // 新消息提示按钮动画
  'new-message-bounce': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-6px)' },
  },

  // 消息出现
  messageSlideIn: {
    keyframes: `
      @keyframes messageSlideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
    duration: '200ms',
    easing: 'ease-out',
  },

  // 思考过程脉动
  thinkingPulse: {
    keyframes: `
      @keyframes thinkingPulse {
        0%, 100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }
    `,
    duration: '2s',
    easing: 'ease-in-out',
    iteration: 'infinite',
  },

  // 工具运行旋转
  toolRunning: {
    keyframes: `
      @keyframes toolRunning {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `,
    duration: '1s',
    easing: 'linear',
    iteration: 'infinite',
  },

  // 加载旋转
  spin: {
    keyframes: `
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `,
    duration: '0.75s',
    easing: 'linear',
    iteration: 'infinite',
  },

  // 骨架屏加载
  skeleton: {
    keyframes: `
      @keyframes skeletonLoading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `,
    duration: '1.5s',
    easing: 'ease-in-out',
    iteration: 'infinite',
  },

  // 打字指示器弹跳
  typingBounce: {
    keyframes: `
      @keyframes typingBounce {
        0%, 60%, 100% {
          transform: translateY(0);
        }
        30% {
          transform: translateY(-4px);
        }
      }
    `,
    duration: '1.4s',
    easing: 'ease-in-out',
    iteration: 'infinite',
  },

  // 淡入
  fadeIn: {
    keyframes: `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
    duration: '200ms',
    easing: 'ease-out',
  },

  // 缩放淡入
  scaleIn: {
    keyframes: `
      @keyframes scaleIn {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
    duration: '200ms',
    easing: 'ease-out',
  },

  // 滑入
  slideInFromBottom: {
    keyframes: `
      @keyframes slideInFromBottom {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
    duration: '300ms',
    easing: 'ease-out',
  },
};

export const createAnimationStyle = (animationName: keyof typeof animations) => {
  const animation = animations[animationName];
  return `
    animation: ${animationName} ${animation.duration} ${animation.easing} ${
    animation.iteration || ''
  }`.trim();
};

export const getAnimationDelay = (index: number, baseDelay: number = 50) => {
  return `${index * baseDelay}ms`;
};

export const generateStaggeredAnimations = (
  count: number,
  animationName: keyof typeof animations = 'messageSlideIn',
  baseDelay: number = 50
) => {
  return Array.from({ length: count }, (_, index) => ({
    index,
    delay: getAnimationDelay(index, baseDelay),
    style: createAnimationStyle(animationName),
  }));
};

export class AnimationController {
  private animations: Map<string, Animation> = new Map();

  play(element: Element, animationName: keyof typeof animations): Animation | null {
    const keyframes = animations[animationName].keyframes;
    const animation = element.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: 200,
        easing: 'ease-out',
        fill: 'forwards',
      }
    );

    this.animations.set(animationName, animation);
    return animation;
  }

  pause(animationName: string): void {
    const animation = this.animations.get(animationName);
    if (animation) {
      animation.pause();
    }
  }

  resume(animationName: string): void {
    const animation = this.animations.get(animationName);
    if (animation) {
      animation.play();
    }
  }

  cancel(animationName: string): void {
    const animation = this.animations.get(animationName);
    if (animation) {
      animation.cancel();
      this.animations.delete(animationName);
    }
  }

  cancelAll(): void {
    this.animations.forEach((animation) => animation.cancel());
    this.animations.clear();
  }
}

export const animationController = new AnimationController();
