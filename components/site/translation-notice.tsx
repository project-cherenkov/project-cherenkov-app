export function TranslationNotice({ message }: { message: string }) {
  return (
    <p
      role="note"
      className="mt-4 rounded-md border border-dashed border-cherenkov-pink-pastel bg-cherenkov-pink/20 p-3 text-sm text-foreground/80"
    >
      {message}
    </p>
  );
}
