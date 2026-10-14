import type { ReactNode } from "react";
import BottomNav from "../../components/Bottomnav/BottomNav";
import type { PageId } from "../../config/Navigation";
import "./MainLayout.css";

interface MainLayoutProps {
  children: ReactNode;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function MainLayout({
  children,
  activePage,
  onNavigate,
}: MainLayoutProps) {
  return (
    <div className="layout">
      <main className="layout__main">
        <div className="layout__content">{children}</div>
      </main>

      <BottomNav activePage={activePage} onNavigate={onNavigate} />
    </div>
  );
}
