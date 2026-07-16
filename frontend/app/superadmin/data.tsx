// ============================================================
// Local/mock data for sections that don't have a backend endpoint
// yet. Swap these out for real API calls as those endpoints land —
// each section below is intentionally isolated so that's a one-file
// change per section, same pattern the branch console uses for its
// warehouse/parcel-ops mock data.
// ============================================================

export interface BusinessAccount {
  id: string;
  name: string;
  type: string;
  monthlyShipments: number;
  codEnabled: boolean;
  status: 'active' | 'pending' | 'suspended';
  contactPhone: string;
  city: string;
}

export const BUSINESS_ACCOUNTS: BusinessAccount[] = [
  { id: 'BIZ-1001', name: 'Daraz Fulfillment Hub', type: 'E-commerce', monthlyShipments: 12400, codEnabled: true, status: 'active', contactPhone: '+92 321 4455667', city: 'Lahore' },
  { id: 'BIZ-1002', name: 'FreshCart Groceries', type: 'Grocery', monthlyShipments: 3200, codEnabled: true, status: 'active', contactPhone: '+92 300 1122334', city: 'Karachi' },
  { id: 'BIZ-1003', name: 'Al-Noor Pharmacy Chain', type: 'Pharmacy', monthlyShipments: 1850, codEnabled: false, status: 'pending', contactPhone: '+92 333 9988776', city: 'Islamabad' },
  { id: 'BIZ-1004', name: 'Threadbare Apparel', type: 'Fashion', monthlyShipments: 940, codEnabled: true, status: 'active', contactPhone: '+92 345 6677889', city: 'Faisalabad' },
  { id: 'BIZ-1005', name: 'QuickBite Restaurants', type: 'Food Delivery', monthlyShipments: 5600, codEnabled: true, status: 'suspended', contactPhone: '+92 312 2233445', city: 'Lahore' },
];

export interface AssignmentRule {
  id: string;
  name: string;
  type: 'proximity' | 'load_balance' | 'manual_only' | 'branch_priority';
  radiusKm?: number;
  active: boolean;
  description: string;
}

export const ASSIGNMENT_RULES: AssignmentRule[] = [
  { id: 'RULE-01', name: 'Nearest Available Rider', type: 'proximity', radiusKm: 3, active: true, description: 'Auto-assign to the closest online rider within radius before widening the search.' },
  { id: 'RULE-02', name: 'Branch Load Balancing', type: 'load_balance', active: true, description: 'Spread new orders evenly across riders currently below their daily delivery average.' },
  { id: 'RULE-03', name: 'High-Value COD → Manual Review', type: 'manual_only', active: true, description: 'Orders with COD value above Rs 15,000 route to branch manager for manual rider selection.' },
  { id: 'RULE-04', name: 'Branch-of-Origin Priority', type: 'branch_priority', active: false, description: 'Prefer riders registered to the pickup branch over riders from neighboring branches.' },
];

export interface MessageTemplate {
  id: string;
  trigger: string;
  channel: 'SMS' | 'WhatsApp' | 'Email' | 'Push';
  body: string;
  active: boolean;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { id: 'MSG-01', trigger: 'Order Created', channel: 'SMS', body: 'Your FastEx order {tracking_number} has been booked. We\'ll notify you once a rider is assigned.', active: true },
  { id: 'MSG-02', trigger: 'Rider Assigned', channel: 'WhatsApp', body: '{rider_name} is on the way to collect your parcel. Track live: {tracking_link}', active: true },
  { id: 'MSG-03', trigger: 'Out for Delivery', channel: 'SMS', body: 'Your parcel {tracking_number} is out for delivery and should arrive today.', active: true },
  { id: 'MSG-04', trigger: 'Delivery Failed', channel: 'WhatsApp', body: 'We couldn\'t deliver {tracking_number}. Reply to reschedule or update the drop-off address.', active: true },
  { id: 'MSG-05', trigger: 'COD Collected', channel: 'SMS', body: 'Payment of Rs {amount} collected for {tracking_number}. Thank you for using FastEx.', active: false },
  { id: 'MSG-06', trigger: 'Delivered', channel: 'Email', body: 'Your order {tracking_number} was delivered on {date}. Rate your experience.', active: true },
];

export interface AdminAlert {
  sev: 'high' | 'medium' | 'low';
  title: string;
  msg: string;
  time: string;
}

export const SYSTEM_ALERTS: AdminAlert[] = [
  { sev: 'high', title: 'Karachi South branch offline', msg: 'No heartbeat from branch console for 14 minutes — orders queuing unassigned.', time: '6 min ago' },
  { sev: 'high', title: 'Payment gateway latency spike', msg: 'Online gateway response time above 8s for the last 10 minutes.', time: '12 min ago' },
  { sev: 'medium', title: '9 riders idle beyond SLA', msg: 'Riders marked online with no assignment for over 45 minutes.', time: '20 min ago' },
  { sev: 'medium', title: 'Business account pending approval', msg: 'Al-Noor Pharmacy Chain has been awaiting KYC approval for 2 days.', time: '1 hr ago' },
  { sev: 'low', title: 'Weekly analytics export ready', msg: 'Network performance report for last week is ready to download.', time: '3 hr ago' },
];

export interface ActivityItem {
  icon: string;
  color: string;
  text: string;
  time: string;
}

export const NETWORK_ACTIVITY: ActivityItem[] = [
  { icon: 'building', color: '#2563EB', text: 'New branch "Multan West" created by super admin', time: '4 min ago' },
  { icon: 'riders', color: '#1E8E5A', text: '3 new riders onboarded across Lahore zone', time: '18 min ago' },
  { icon: 'business', color: '#F2A93B', text: 'Business account "Threadbare Apparel" upgraded to bulk pricing', time: '35 min ago' },
  { icon: 'alert', color: '#D8432C', text: 'Auto-assignment rule "Nearest Available Rider" radius updated to 3km', time: '52 min ago' },
  { icon: 'message', color: '#173868', text: 'Messaging template "Delivery Failed" edited', time: '1 hr ago' },
];

export const NETWORK_COMPARISON = [
  { label: 'Delivery Success Rate', thisWeek: 90, lastWeek: 87 },
  { label: 'On-Time Pickup Rate', thisWeek: 86, lastWeek: 88 },
  { label: 'Avg. Rider Utilization', thisWeek: 78, lastWeek: 74 },
];