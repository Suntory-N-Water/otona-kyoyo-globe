import { BackButton } from '@/components/overlay/back-button';
import { CONTACT_FORM_URL } from '@/lib/constants';

type ContactViewProps = {
  onBack: () => void;
};

export function ContactView({ onBack }: ContactViewProps) {
  return (
    <div className='fixed inset-0 flex flex-col bg-black/95'>
      <BackButton onClick={onBack} />

      <div className='mx-auto w-full max-w-2xl shrink-0 px-6 pb-4 pt-16'>
        <h1 className='text-xl font-bold text-white'>お問い合わせ</h1>
        <p className='mt-2 text-sm leading-relaxed text-white/70'>
          本サービス(大人の教養TV
          ロケ地マップ)に関するご意見・ご要望・不具合の報告などはこちらからお送りください。
        </p>
        <p className='mt-1 text-xs leading-relaxed text-white/40'>
          ※
          動画内容・チャンネルに関するお問い合わせは「大人の教養TV」へ直接お寄せください。
        </p>
      </div>

      <div className='mx-auto min-h-0 w-full max-w-2xl flex-1 px-6 pb-6'>
        {CONTACT_FORM_URL ? (
          <iframe
            src={`${CONTACT_FORM_URL}?embedded=true`}
            title='お問い合わせフォーム'
            className='h-full w-full rounded-xl border border-white/10'
            style={{ colorScheme: 'light' }}
          >
            読み込んでいます…
          </iframe>
        ) : (
          <p className='text-sm text-white/40'>
            お問い合わせフォームは現在準備中です。
          </p>
        )}
      </div>
    </div>
  );
}
