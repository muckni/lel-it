import { InboxList } from "@/components/inbox/inbox-list";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Emails you forwarded, ready to file as lessons.
        </p>
      </header>
      <InboxList />
    </div>
  );
}
