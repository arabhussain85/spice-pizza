import { AdminNav } from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <div className="flex-1 px-4 pb-24 pt-4">{children}</div>
      <AdminNav />
    </div>
  );
}
