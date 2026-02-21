import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { LocationGroup } from '@/types/location';
import { VideoCard } from './video-card';

type VideoPanelProps = {
  group: LocationGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VideoPanel({ group, open, onOpenChange }: VideoPanelProps) {
  if (!group) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full overflow-y-auto sm:max-w-md'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            {group.name}
            <Badge variant='secondary'>{group.videos.length}本</Badge>
          </SheetTitle>
          <SheetDescription>この場所に関連する動画</SheetDescription>
        </SheetHeader>
        <div className='mt-4 flex flex-col gap-2'>
          {group.videos.map((video) => (
            <VideoCard key={video.videoId} video={video} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
