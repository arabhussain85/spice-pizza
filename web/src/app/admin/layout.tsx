import { AdminNav } from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#FCF9F5]">
      <AdminNav />
      {/* Main content area - full width, padding bottom for mobile nav */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
