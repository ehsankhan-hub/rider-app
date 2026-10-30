export const ROLES = ['CUSTOMER', 'DRIVER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const RIDE_STATUSES = [
  'requested',
  'searching',
  'assigned',
  'arriving',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'WALLET'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface JwtAccessPayload {
  sub: string;
  role: Role;
  email: string;
}
