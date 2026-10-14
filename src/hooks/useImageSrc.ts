import { useEffect, useState } from 'react';
import type { ImageData } from '../types';
import { loadImageSrc, peekImageSrc } from '../utils/imageCache';

export type ImageSrcStatus = 'loading' | 'loaded' | 'missing' | 'error';

export interface ImageSrcState {
  status: ImageSrcStatus;
  src?: string;
  onError: () => void;
}

type ImageResult = Pick<ImageSrcState, 'status' | 'src'>;
interface TrackedImageResult {
  projectId: string;
  imageId: string;
  inlineData: string | undefined;
  result: ImageResult;
}

export function useImageSrc(projectId: string, image: ImageData | null | undefined): ImageSrcState {
  const imageId = image?.id ?? '';
  const inlineData = image?.data;
  const immediateResult = (): ImageResult => {
    if (!image) return { status: 'missing' };
    const src = inlineData || peekImageSrc(projectId, imageId);
    return src ? { status: 'loaded', src } : { status: 'loading' };
  };
  const [state, setState] = useState<TrackedImageResult>(() => ({
    projectId, imageId, inlineData, result: immediateResult(),
  }));

  useEffect(() => {
    const update = (result: ImageResult) => setState({ projectId, imageId, inlineData, result });
    const immediate = immediateResult();
    if (immediate.status !== 'loading' || !image) {
      update(immediate);
      return;
    }
    let alive = true;
    update({ status: 'loading' });
    void loadImageSrc(projectId, image)
      .then((data) => {
        if (alive) update(data ? { status: 'loaded', src: data } : { status: 'missing' });
      })
      .catch(() => {
        if (alive) update({ status: 'error' });
      });
    return () => { alive = false; };
    // 图片对象可能重建；依赖身份与字节，避免无关渲染重复读库。
  }, [projectId, imageId, inlineData]);

  const matches = state.projectId === projectId && state.imageId === imageId && state.inlineData === inlineData;
  return {
    ...(matches ? state.result : immediateResult()),
    onError: () => setState(previous => {
      if (previous.projectId !== projectId || previous.imageId !== imageId || previous.inlineData !== inlineData) return previous;
      return { ...previous, result: { status: 'error' } };
    }),
  };
}
