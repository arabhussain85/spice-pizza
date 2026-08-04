import { BillView } from "./BillView";

export default async function BillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <BillView orderId={orderId} />;
}
