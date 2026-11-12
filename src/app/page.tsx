import Link from "next/link";
import { TOOLS } from "@/lib/tool-list";
import { SITE } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-medium">{SITE.name}</h1>
      <p className="mt-1 text-muted-foreground">{SITE.tagline}</p>
      <ul className="mt-10 border-t border-foreground">
        {TOOLS.map((t) => (
          <li key={t.slug} className="border-b border-foreground">
            <Link href={`/${t.slug}/`} className="flex items-baseline justify-between gap-4 py-3 no-underline hover:underline">
              <span className="font-medium">
                {t.name}
                {t.server && <span className="ml-2 border border-foreground px-1 text-xs font-normal">uploads</span>}
              </span>
              <span className="text-right text-sm text-muted-foreground">{t.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
