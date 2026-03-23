import { MousePointer2, X } from 'lucide-react';

type GuideOverlayProps = {
  onDismiss: () => void;
};

export function GuideOverlay({ onDismiss }: GuideOverlayProps) {
  return (
    <div className='pointer-events-none fixed inset-0 z-20 flex items-end justify-center pb-8'>
      <div className='pointer-events-auto relative mx-4 max-w-sm w-full rounded-2xl border border-white/10 bg-black/75 px-6 py-5 backdrop-blur-md'>
        <button
          type='button'
          onClick={onDismiss}
          className='absolute top-3 right-3 cursor-pointer rounded-full p-1 text-white/40 hover:text-white/80'
          aria-label='閉じる'
        >
          <X className='size-4' />
        </button>
        <div className='flex items-start gap-4'>
          <div className='flex-shrink-0 rounded-full bg-amber-400/20 p-2.5'>
            <MousePointer2 className='size-5 text-amber-400 animate-bounce' />
          </div>
          <div>
            <p className='text-sm font-semibold text-white'>
              ピンをタップして探索
            </p>
            <p className='mt-1 text-xs leading-relaxed text-white/60'>
              地球儀上のピンをクリックすると、その場所で撮影された動画が見られます
            </p>
            <p className='mt-1 text-xs leading-relaxed text-white/40'>
              ピンが見えなくなったら、ズームすると再表示されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
