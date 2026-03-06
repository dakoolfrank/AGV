import { DashboardAccessWrapper } from "@/components/dashboard/dashboard-access-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardAccessWrapper>
      {children}
    </DashboardAccessWrapper>
  );
}
