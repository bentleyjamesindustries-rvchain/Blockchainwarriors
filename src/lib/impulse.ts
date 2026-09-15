import type { Bias, ThesisLock } from "./types";

export interface ImpulseProj {
  valid: boolean;
  w1Len: number;
  w2Depth: number;
  invalidation: number;
  tp1: number;
  tp2: number;
}

export function w2PastOrigin(w1Start: number, w1End: number, w2End: number, bias: Bias): boolean {
  if (bias === "long") return w2End <= w1Start || w1End <= w1Start;
  return w2End >= w1Start || w1End >= w1Start;
}

export function impulseProj(w1Start: number, w1End: number, w2End: number, mark: number, bias: Bias): ImpulseProj {
  const w1Len = Math.abs(w1End - w1Start);
  const w2Depth = w1Len > 0 ? Math.abs(w1End - w2End) / w1Len : 0;
  const valid = w1Len > 0 && w2Depth > 0 && w2Depth < 0.999 && !w2PastOrigin(w1Start, w1End, w2End, bias);
  if (bias === "long") {
    const minW3 = Math.max(w1End * 1.001, w2End + w1Len);
    const ext1618 = w2End + w1Len * 1.618;
    const ext2618 = w2End + w1Len * 2.618;
    let tp1 = Math.max(minW3, ext1618);
    let tp2 = Math.max(ext2618, tp1 * 1.12);
    if (mark > tp1) {
      tp1 = Math.max(ext2618, mark * 1.015);
      tp2 = w2End + w1Len * 4.236;
    }
    let invalidation = w2End * 0.985;
    if (invalidation >= mark) invalidation = Math.min(w2End, mark * 0.978);
    if (invalidation <= w1Start) invalidation = w1Start * 1.001;
    return { valid, w1Len, w2Depth, invalidation, tp1, tp2 };
  }
  const minW3 = Math.min(w1End * 0.999, w2End - w1Len);
  const ext1618 = w2End - w1Len * 1.618;
  const ext2618 = w2End - w1Len * 2.618;
  let tp1 = Math.min(minW3, ext1618);
  let tp2 = Math.min(ext2618, tp1 * 0.88);
  if (mark < tp1) {
    tp1 = Math.min(ext2618, mark * 0.985);
    tp2 = w2End - w1Len * 4.236;
  }
  let invalidation = w2End * 1.015;
  if (invalidation <= mark) invalidation = Math.max(w2End, mark * 1.022);
  if (invalidation >= w1Start) invalidation = w1Start * 0.999;
  return { valid, w1Len, w2Depth, invalidation, tp1, tp2 };
}

export function preferredW2(depth: number): boolean {
  return depth >= 0.5 && depth <= 0.887;
}

export function lockGeometry(lock: ThesisLock, mark: number): ImpulseProj {
  return impulseProj(lock.pivots.w1Start, lock.pivots.w1End, lock.pivots.w2End, mark, lock.bias);
}
