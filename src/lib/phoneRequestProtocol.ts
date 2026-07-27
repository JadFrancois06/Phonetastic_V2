export type PhoneTransferRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PhoneTransferColorDetail {
  color: string;
  qty: number;
  reference?: string;
  price?: number | string;
  batteryHealth?: string;
  screenCondition?: string;
  frameCondition?: string;
}

export interface PhoneTransferRequestPayload {
  type: 'phone_transfer_request';
  requestId: string;
  phoneId: string;
  phoneLabel: string;
  storage?: string;
  ram?: string;
  condition?: string;
  basePrice?: number | string;
  colorDetails?: PhoneTransferColorDetail[];
  fromStore: string;
  toStore: string;
  requesterId: string;
  requesterName: string;
  receiverId: string;
  qty: number;
  createdAt: string;
}

export interface PhoneTransferResponsePayload {
  type: 'phone_transfer_response';
  requestId: string;
  phoneId: string;
  status: Exclude<PhoneTransferRequestStatus, 'pending'>;
  reason?: string;
  responderId: string;
  responderName: string;
  createdAt: string;
}

const PHONE_TRANSFER_REQUEST_PREFIX = '[PHONE_TRANSFER_REQUEST]';
const PHONE_TRANSFER_RESPONSE_PREFIX = '[PHONE_TRANSFER_RESPONSE]';

export function buildPhoneTransferRequestContent(payload: PhoneTransferRequestPayload): string {
  return `${PHONE_TRANSFER_REQUEST_PREFIX}${JSON.stringify(payload)}`;
}

export function buildPhoneTransferResponseContent(payload: PhoneTransferResponsePayload): string {
  return `${PHONE_TRANSFER_RESPONSE_PREFIX}${JSON.stringify(payload)}`;
}

export function parsePhoneTransferMessage(content: string):
  | { kind: 'request'; data: PhoneTransferRequestPayload }
  | { kind: 'response'; data: PhoneTransferResponsePayload }
  | null {
  if (!content) return null;

  if (content.startsWith(PHONE_TRANSFER_REQUEST_PREFIX)) {
    try {
      const data = JSON.parse(content.slice(PHONE_TRANSFER_REQUEST_PREFIX.length)) as PhoneTransferRequestPayload;
      if (data.type !== 'phone_transfer_request' || !data.requestId || !data.phoneId) return null;
      return { kind: 'request', data };
    } catch {
      return null;
    }
  }

  if (content.startsWith(PHONE_TRANSFER_RESPONSE_PREFIX)) {
    try {
      const data = JSON.parse(content.slice(PHONE_TRANSFER_RESPONSE_PREFIX.length)) as PhoneTransferResponsePayload;
      if (data.type !== 'phone_transfer_response' || !data.requestId || !data.phoneId) return null;
      return { kind: 'response', data };
    } catch {
      return null;
    }
  }

  return null;
}
