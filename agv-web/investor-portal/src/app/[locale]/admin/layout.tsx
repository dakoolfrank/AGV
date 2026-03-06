import { DashboardAccessWrapper } from '@/components/admin/DashboardAccessWrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAccessWrapper>
      {children}
    </DashboardAccessWrapper>
  );
}
