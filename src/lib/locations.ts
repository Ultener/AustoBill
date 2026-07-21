/** Доступные Pterodactyl-ноды при покупке игровых / кодинг серверов */
export const PTERO_PURCHASE_NODE_IDS = [1, 2] as const;

export type PteroPurchaseNodeId = (typeof PTERO_PURCHASE_NODE_IDS)[number];

export interface PteroLocation {
  nodeId: PteroPurchaseNodeId;
  label: string;
  shortLabel: string;
  /** Временно недоступна для новых заказов */
  overloaded?: boolean;
  overloadedMessage?: string;
}

export const PTERO_LOCATIONS: PteroLocation[] = [
  {
    nodeId: 1,
    label: 'Германия 1',
    shortLabel: 'DE-1',
    overloaded: true,
    overloadedMessage: 'Сервис переполнен',
  },
  { nodeId: 2, label: 'Германия 2', shortLabel: 'DE-2', overloadedMessage: 'Нет свободных портов' },
];

/** Ноды, временно закрытые для покупки (синхронизировать с server.js) */
export const OVERLOADED_PTERO_NODE_IDS: PteroPurchaseNodeId[] = [1];

export const DEFAULT_PTERO_NODE_ID: PteroPurchaseNodeId = 2;

export function isPteroNodeOverloaded(nodeId: number): boolean {
  return OVERLOADED_PTERO_NODE_IDS.includes(nodeId as PteroPurchaseNodeId);
}

export function getFirstAvailablePteroNodeId(): PteroPurchaseNodeId {
  const available = PTERO_LOCATIONS.find(loc => !loc.overloaded);
  return available?.nodeId ?? DEFAULT_PTERO_NODE_ID;
}

export function getPteroLocationLabel(nodeId: number | null | undefined): string {
  return PTERO_LOCATIONS.find(l => l.nodeId === nodeId)?.label ?? 'Германия';
}

export function isPteroPurchaseNode(nodeId: number): nodeId is PteroPurchaseNodeId {
  return (PTERO_PURCHASE_NODE_IDS as readonly number[]).includes(nodeId);
}

/** VDS (Proxmox) — отдельная инфраструктура */
export const VPS_LOCATION = { name: 'Германия', nodeId: 10 } as const;
