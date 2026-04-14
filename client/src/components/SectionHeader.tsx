/**
 * SectionHeader — Swiss Financial Design
 * 
 * Oversized light-grey section number with title and subtitle.
 * The number sits behind the text as a watermark.
 */

interface SectionHeaderProps {
  number: string;
  title: string;
  subtitle?: string;
}

export default function SectionHeader({ number, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="relative mb-10">
      <span className="section-number">{number}</span>
      <div className="relative z-10 pt-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-lg">
            {subtitle}
          </p>
        )}
      </div>
      <div className="hairline mt-4" />
    </div>
  );
}
