import { BackButton } from '@/components/overlay/back-button';

type PrivacyViewProps = {
  onBack: () => void;
  onContact: () => void;
};

export function PrivacyView({ onBack, onContact }: PrivacyViewProps) {
  return (
    <div className='fixed inset-0 overflow-y-auto bg-black/95'>
      <BackButton onClick={onBack} />
      <div className='mx-auto max-w-2xl px-6 pb-16 pt-20'>
        <h1 className='text-xl font-bold text-white'>プライバシーポリシー</h1>
        <p className='mt-1 text-xs text-white/40'>最終更新日: 2026年3月23日</p>

        <section className='mt-8'>
          <h2 className='text-sm font-semibold text-amber-400'>
            このサービスについて
          </h2>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            本サービス「大人の教養TV
            ロケ地マップ」は、YouTubeチャンネル「大人の教養TV」のロケ地を3D地球儀で探索できる非公式のファンサイトです。チャンネルおよびその運営者とは一切関係がありません。
          </p>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            本サービスは商業目的ではなく、視聴者の利便性向上を目的として個人が運営しています。動画コンテンツ・字幕の著作権は「大人の教養TV」に帰属します。
          </p>
        </section>

        <section className='mt-6'>
          <h2 className='text-sm font-semibold text-amber-400'>
            ロケーション情報の生成方法
          </h2>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            地図上に表示されるロケーション情報は、「大人の教養TV」の動画字幕を生成AI(Google
            Gemini
            API)で自動解析し、地名を抽出・ジオコーディングして生成しています。
          </p>
        </section>

        <section className='mt-6'>
          <h2 className='text-sm font-semibold text-amber-400'>
            情報の正確性について
          </h2>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            ロケーション情報はAIによる自動生成のため、実際のロケーション地と異なる場合があります。情報の正確性を保証するものではありません。
          </p>
        </section>

        <section className='mt-6'>
          <h2 className='text-sm font-semibold text-amber-400'>収集する情報</h2>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            本サービスは個人情報を収集しません。
            ガイドの表示状態のみブラウザのローカルストレージに保存します(サーバーへの送信はありません)。
          </p>
        </section>

        <section className='mt-6'>
          <h2 className='text-sm font-semibold text-amber-400'>
            利用する外部サービス
          </h2>
          <ul className='mt-2 space-y-1 text-sm leading-relaxed text-white/70'>
            <li>・YouTube(動画コンテンツの表示)</li>
            <li>・OpenStreetMap / CartoDB(地図タイルの表示)</li>
            <li>・Google Gemini API(地名抽出のためのAI解析)</li>
          </ul>
        </section>

        <section className='mt-6'>
          <h2 className='text-sm font-semibold text-amber-400'>お問い合わせ</h2>
          <p className='mt-2 text-sm leading-relaxed text-white/70'>
            本サービスに関するお問い合わせは
            <button
              type='button'
              onClick={onContact}
              className='ml-1 cursor-pointer text-amber-400 hover:text-amber-300 underline underline-offset-2'
            >
              お問い合わせフォーム
            </button>
            からご連絡ください。
          </p>
        </section>
      </div>
    </div>
  );
}
