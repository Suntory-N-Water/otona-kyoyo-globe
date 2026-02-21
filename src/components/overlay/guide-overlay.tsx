import { Button } from '@/components/ui/button';

type GuideOverlayProps = {
  onDismiss: () => void;
};

export function GuideOverlay({ onDismiss }: GuideOverlayProps) {
  return (
    <div className='pointer-events-none fixed inset-0 z-20 flex items-end justify-center pb-20'>
      <div className='pointer-events-auto rounded-xl bg-card/90 px-6 py-4 text-center shadow-lg backdrop-blur-sm'>
        <p className='text-sm text-foreground'>
          ピンをクリックして動画の場所へ飛ぼう
        </p>
        <Button
          variant='ghost'
          size='sm'
          className='mt-2 text-xs text-muted-foreground'
          onClick={onDismiss}
        >
          閉じる
        </Button>
      </div>
    </div>
  );
}
