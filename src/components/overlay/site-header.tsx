import { Button } from '@/components/ui/button';
import { CHANNEL_URL } from '@/lib/constants';

export function SiteHeader() {
  return (
    <header className='pointer-events-none fixed top-0 right-0 left-0 z-10 flex items-center justify-between px-4 py-3'>
      <h1 className='text-lg font-bold text-white drop-shadow-lg'>
        大人の教養TV ロケ地マップ
      </h1>
      <Button
        variant='ghost'
        size='sm'
        className='pointer-events-auto text-white/70 hover:text-white'
        asChild
      >
        <a href={CHANNEL_URL} target='_blank' rel='noopener noreferrer'>
          YouTubeチャンネル
        </a>
      </Button>
    </header>
  );
}
