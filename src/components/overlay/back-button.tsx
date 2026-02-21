import { Button } from '@/components/ui/button';

type BackButtonProps = {
  onClick: () => void;
};

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <div className='fixed top-3 left-4 z-10'>
      <Button variant='secondary' size='sm' onClick={onClick}>
        &larr; 地球儀に戻る
      </Button>
    </div>
  );
}
