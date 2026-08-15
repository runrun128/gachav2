export interface TradeOfferItem {
  itemKey: string;
  quantity: number;
}

export interface TradeOffer {
  characterIds: string[];
  items: TradeOfferItem[];
  coins: number;
  confirmed: boolean;
}

export interface TradeRoom {
  id: string;
  userIds: [string, string];
  displayNames: Record<string, string>;
  offers: Record<string, TradeOffer>;
  createdAt: number;
}

export interface PendingTradeInvite {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
}
