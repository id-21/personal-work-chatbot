'use client';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface LottieLoaderProps {
  size?: number;
  className?: string;
}

export function LottieLoader({ size = 48, className }: LottieLoaderProps) {
  return (
    <DotLottieReact
      src="/Material wave loading.lottie"
      loop
      autoplay
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
