import type { Video } from '@/types/location';

type VideoCardProps = {
  video: Video;
};

function formatViewCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万回`;
  }
  return `${count.toLocaleString()}回`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.videoId}`}
      target='_blank'
      rel='noopener noreferrer'
      className='flex gap-3 rounded-lg p-2 transition-colors hover:bg-accent'
    >
      <img
        src={video.thumbnailUrl}
        alt=''
        className='h-[68px] w-[120px] shrink-0 rounded-md object-cover'
        loading='lazy'
      />
      <div className='min-w-0 flex-1'>
        <p className='line-clamp-2 text-sm leading-tight'>{video.title}</p>
        <p className='mt-1 text-xs text-muted-foreground'>
          {formatViewCount(video.viewCount)} ・ {formatDate(video.publishedAt)}
        </p>
      </div>
    </a>
  );
}
