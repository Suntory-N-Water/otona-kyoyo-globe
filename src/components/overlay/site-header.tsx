import { Globe, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHANNEL_URL } from '@/lib/constants';

export function SiteHeader() {
  return (
    <>
      {/* 上部グラデーション: ヘッダーテキスト視認性確保 */}
      <div className='pointer-events-none fixed inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/70 to-transparent' />
      <header className='pointer-events-none fixed top-0 right-0 left-0 z-10 flex items-center justify-between px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Globe className='size-5 text-amber-400' strokeWidth={1.5} />
          <h1 className='text-base font-bold text-white drop-shadow-lg'>
            大人の教養TV
            <span className='text-amber-400'> ロケ地マップ</span>
          </h1>
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/10 px-3 text-white/80 backdrop-blur-sm hover:bg-white/20 hover:text-white'
          asChild
        >
          <a href={CHANNEL_URL} target='_blank' rel='noopener noreferrer'>
            <Youtube className='size-4 text-red-400' />
            <span className='text-xs'>YouTubeで見る</span>
          </a>
        </Button>
      </header>
    </>
  );
}
