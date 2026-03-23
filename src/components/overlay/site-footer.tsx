type SiteFooterProps = {
  onPrivacy: () => void;
  onContact: () => void;
};

export function SiteFooter({ onPrivacy, onContact }: SiteFooterProps) {
  return (
    <>
      {/* 下部グラデーション: フッターテキスト視認性確保 */}
      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-black/70 to-transparent' />
      <footer className='pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-end justify-center pb-3'>
        <div className='pointer-events-auto flex items-center gap-4'>
          <button
            type='button'
            onClick={onPrivacy}
            className='cursor-pointer text-xs text-white/40 hover:text-white/70 transition-colors'
          >
            プライバシーポリシー
          </button>
          <span className='text-white/20 text-xs'>|</span>
          <button
            type='button'
            onClick={onContact}
            className='cursor-pointer text-xs text-white/40 hover:text-white/70 transition-colors'
          >
            お問い合わせ
          </button>
        </div>
      </footer>
    </>
  );
}
