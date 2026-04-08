import React from 'react';

type SidebarToggleButtonProps = {
  collapsed: boolean;
  isMobile: boolean;
  onToggle: () => void;
};

export default function SidebarToggleButton({ collapsed, isMobile, onToggle }: SidebarToggleButtonProps) {
  return (
    <button
      type="button"
      className={`platform-sidebar-toggle ${collapsed ? 'is-collapsed' : ''}`.trim()}
      onClick={onToggle}
      aria-label={isMobile ? 'Open navigation' : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
      aria-pressed={isMobile ? undefined : !collapsed}
      title={isMobile ? 'Navigation' : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
    >
      <span className="platform-sidebar-toggle-icon" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}

