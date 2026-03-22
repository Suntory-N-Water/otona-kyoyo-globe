import { ArrowLeft } from 'lucide-react';

type BackButtonProps = {
  onClick: () => void;
};

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <div className='fixed top-3 left-4 z-10'>
      <button
        type='button'
        onClick={onClick}
        className='flex cursor-pointer items-center gap-1.5 rounded-full bg-black/65 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/85'
      >
        <ArrowLeft className='size-4' />
        地球儀に戻る
      </button>
    </div>
  );
}
