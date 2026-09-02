import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center gap-3 px-5">
      <div className="text-5xl font-bold text-[var(--color-gold)]" style={{ fontFamily: "'Playfair Display', serif" }}>
        404
      </div>
      <h2 className="text-base font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
        الصفحة غير موجودة · Page not found
      </h2>
      <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm">
        الرابط ده مش موجود، ممكن يكون اتشال أو الرابط غلط.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--color-text-secondary)] text-[12.5px] hover:text-[var(--color-foreground)] transition-colors"
      >
        الرئيسية · Home
      </Link>
    </div>
  );
}
