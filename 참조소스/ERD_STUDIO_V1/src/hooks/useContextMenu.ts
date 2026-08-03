import { useCallback } from 'react';
import { useSchemaStore } from '../store/schemaStore';

export function useContextMenu() {
  const { setContextMenu } = useSchemaStore();

  const showMenu = useCallback((e: React.MouseEvent, targetType: 'table' | 'canvas' | 'column', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      targetType,
      targetId
    });
  }, [setContextMenu]);

  const hideMenu = useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  return { showMenu, hideMenu };
}
