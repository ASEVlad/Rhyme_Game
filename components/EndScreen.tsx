'use client';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-4xl font-extrabold">Гарна робота!</h2>
      <button
        onClick={onPlayAgain}
        className="rounded-2xl bg-rhyme-yellow px-10 py-4 text-2xl font-bold text-bg"
      >
        Грати знову
      </button>
      <button
        onClick={onChangeBeat}
        className="rounded-2xl bg-white/10 px-10 py-4 text-xl"
      >
        Інший біт
      </button>
    </div>
  );
}
