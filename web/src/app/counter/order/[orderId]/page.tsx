import { OrderBuilder } from "./OrderBuilder";

export default async function OrderBuilderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderBuilder orderId={orderId} />;
}
