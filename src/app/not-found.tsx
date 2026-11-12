import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-medium">Not found</h1>
      <p className="mt-4">
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
