// Mock data for the branch console. Replace each block with a real API call
// (see comments) once the corresponding backend endpoints exist - most of
// this (pickups, deliveries, warehouse, staff attendance, transfers) has no
// backend support yet; riders/branches partially do (GET /admin/riders,
// GET /admin/branches) and could be wired in first.

export interface Rider {
  name: string;
  vehicle: string;
  status: 'online' | 'busy' | 'offline';
  score: number;
  success: number;
  deliveries: number;
  gps: string;
}

export interface Pickup {
  id: string;
  customer: string;
  zone: string;
  slot: string;
  rider: string | null;
  arrival: string;
  status: 'Pending' | 'Assigned' | 'Picked Up' | 'Failed';
  fail?: string;
}

export interface Delivery {
  id: string;
  customer: string;
  zone: string;
  rider: string | null;
  progress: number;
  status: 'Ready' | 'Out for Delivery' | 'Delivered' | 'Failed' | 'Rescheduled';
  proof: string;
}

export interface StaffMember {
  name: string;
  role: string;
  attendance: 'Present' | 'On Leave' | 'Absent';
  contact: string;
  perm: string;
}

export interface ZoneCoverage {
  zone: string;
  codes: string;
  radius: string;
  sameDay: boolean;
  express: boolean;
}

export interface ActivityItem {
  icon: string;
  color: string;
  text: string;
  time: string;
}

export interface AlertItem {
  sev: 'high' | 'medium' | 'low';
  title: string;
  msg: string;
  time: string;
}

export interface ScanLogEntry {
  id: string;
  type: 'Incoming' | 'Outgoing';
  time: string;
}

export const INITIAL_RIDERS: Rider[] = [
  { name: 'Bilal Ahmed', vehicle: 'Bike · LEA-2214', status: 'online', score: 4.8, success: 96, deliveries: 14, gps: '31.520, 74.345 · Gulberg' },
  { name: 'Ayesha Khan', vehicle: 'Bike · LEB-9931', status: 'busy', score: 4.6, success: 93, deliveries: 11, gps: '31.498, 74.331 · Model Town' },
  { name: 'Hassan Iqbal', vehicle: 'Van · LED-4471', status: 'busy', score: 4.9, success: 97, deliveries: 18, gps: '31.552, 74.360 · Johar Town' },
  { name: 'Zeeshan Tariq', vehicle: 'Bike · LEC-3382', status: 'offline', score: 4.2, success: 88, deliveries: 6, gps: 'Off duty since 4:10 PM' },
  { name: 'Sana Malik', vehicle: 'Bike · LEA-1187', status: 'online', score: 4.7, success: 95, deliveries: 12, gps: '31.507, 74.352 · Liberty' },
  { name: 'Usman Ghani', vehicle: 'Van · LEE-6620', status: 'busy', score: 4.5, success: 91, deliveries: 16, gps: '31.480, 74.300 · Township' },
  { name: 'Rimsha Aslam', vehicle: 'Bike · LEB-7745', status: 'online', score: 4.4, success: 90, deliveries: 9, gps: '31.540, 74.370 · DHA Phase 5' },
  { name: 'Danish Butt', vehicle: 'Bike · LEC-2298', status: 'busy', score: 4.6, success: 94, deliveries: 13, gps: '31.515, 74.320 · Garden Town' },
  { name: 'Fahad Sheikh', vehicle: 'Bike · LED-5561', status: 'offline', score: 4.1, success: 86, deliveries: 5, gps: 'Off duty since 2:30 PM' },
  { name: 'Nida Bibi', vehicle: 'Bike · LEA-8834', status: 'online', score: 4.8, success: 97, deliveries: 15, gps: '31.560, 74.340 · Faisal Town' },
  { name: 'Kamran Shah', vehicle: 'Van · LEF-1123', status: 'busy', score: 4.3, success: 89, deliveries: 17, gps: '31.490, 74.310 · Wapda Town' },
  { name: 'Farah Naz', vehicle: 'Bike · LEB-6602', status: 'online', score: 4.9, success: 98, deliveries: 10, gps: '31.530, 74.380 · Iqbal Town' },
];

export const INITIAL_PICKUPS: Pickup[] = [
  { id: 'PK-70231', customer: 'Ahmed Traders', zone: 'Gulberg III', slot: '10:00–11:00 AM', rider: 'Bilal Ahmed', arrival: 'Arrived', status: 'Picked Up' },
  { id: 'PK-70232', customer: 'Ayesha Boutique', zone: 'Model Town', slot: '11:00–12:00 PM', rider: 'Ayesha Khan', arrival: 'En Route', status: 'Assigned' },
  { id: 'PK-70233', customer: 'Prime Electronics', zone: 'Johar Town', slot: '12:00–1:00 PM', rider: null, arrival: 'Not Started', status: 'Pending' },
  { id: 'PK-70234', customer: 'Zara Home Store', zone: 'DHA Phase 5', slot: '1:00–2:00 PM', rider: null, arrival: 'Not Started', status: 'Pending' },
  { id: 'PK-70235', customer: 'Bilal General Store', zone: 'Township', slot: '2:00–3:00 PM', rider: 'Usman Ghani', arrival: 'Arrived', status: 'Picked Up' },
  { id: 'PK-70236', customer: 'Sitara Fashion', zone: 'Garden Town', slot: '3:00–4:00 PM', rider: 'Danish Butt', arrival: 'En Route', status: 'Assigned' },
  { id: 'PK-70237', customer: 'Al-Fateh Mart', zone: 'Faisal Town', slot: '9:00–10:00 AM', rider: 'Nida Bibi', arrival: 'Arrived', status: 'Failed', fail: 'Store closed on arrival' },
  { id: 'PK-70238', customer: 'Rehman Books', zone: 'Iqbal Town', slot: '4:00–5:00 PM', rider: null, arrival: 'Not Started', status: 'Pending' },
  { id: 'PK-70239', customer: 'Noor Cosmetics', zone: 'Liberty Market', slot: '10:30–11:30 AM', rider: 'Sana Malik', arrival: 'Arrived', status: 'Picked Up' },
  { id: 'PK-70240', customer: 'City Pharma', zone: 'Wapda Town', slot: '5:00–6:00 PM', rider: 'Kamran Shah', arrival: 'En Route', status: 'Assigned' },
];

export const INITIAL_DELIVERIES: Delivery[] = [
  { id: 'FX-582011', customer: 'Kashif Raza', zone: 'Gulberg III', rider: 'Bilal Ahmed', progress: 100, status: 'Delivered', proof: 'OTP' },
  { id: 'FX-582012', customer: 'Mehwish Ali', zone: 'Model Town', rider: 'Ayesha Khan', progress: 65, status: 'Out for Delivery', proof: '—' },
  { id: 'FX-582013', customer: 'Owais Tariq', zone: 'Johar Town', rider: 'Hassan Iqbal', progress: 40, status: 'Out for Delivery', proof: '—' },
  { id: 'FX-582014', customer: 'Sana Yousaf', zone: 'DHA Phase 5', rider: null, progress: 0, status: 'Ready', proof: '—' },
  { id: 'FX-582015', customer: 'Imran Chaudhry', zone: 'Township', rider: 'Usman Ghani', progress: 80, status: 'Out for Delivery', proof: '—' },
  { id: 'FX-582016', customer: 'Faryal Shah', zone: 'Garden Town', rider: 'Danish Butt', progress: 100, status: 'Delivered', proof: 'Signature' },
  { id: 'FX-582017', customer: 'Adeel Mirza', zone: 'Faisal Town', rider: 'Nida Bibi', progress: 100, status: 'Failed', proof: '—' },
  { id: 'FX-582018', customer: 'Hira Baig', zone: 'Iqbal Town', rider: null, progress: 0, status: 'Ready', proof: '—' },
  { id: 'FX-582019', customer: 'Waleed Aslam', zone: 'Liberty Market', rider: 'Sana Malik', progress: 100, status: 'Delivered', proof: 'Photo' },
  { id: 'FX-582020', customer: 'Zoya Naeem', zone: 'Wapda Town', rider: 'Kamran Shah', progress: 55, status: 'Out for Delivery', proof: '—' },
  { id: 'FX-582021', customer: 'Bilal Sarwar', zone: 'Gulberg II', rider: 'Farah Naz', progress: 100, status: 'Delivered', proof: 'OTP' },
  { id: 'FX-582022', customer: 'Nimra Javed', zone: 'Cantt', rider: null, progress: 0, status: 'Ready', proof: '—' },
];

export const RECEIVING_QUEUE = [
  { id: 'FX-591044', from: 'Karachi Branch', sort: 'In Progress' },
  { id: 'FX-591045', from: 'Islamabad Branch', sort: 'Pending' },
  { id: 'FX-591046', from: 'Faisalabad Branch', sort: 'Sorted' },
  { id: 'FX-591047', from: 'Multan Branch', sort: 'Pending' },
];

export const DISPATCH_QUEUE = [
  { id: 'FX-592011', to: 'Rawalpindi HQ', status: 'Ready to Load' },
  { id: 'FX-592012', to: 'Peshawar Branch', status: 'Loading' },
  { id: 'FX-592013', to: 'Quetta Branch', status: 'Ready to Load' },
];

export const TRANSFER_HISTORY = [
  { id: 'FX-590021', dir: 'Inbound', branch: 'Karachi Branch', date: 'Jul 07, 8:12 AM' },
  { id: 'FX-590022', dir: 'Outbound', branch: 'Islamabad Branch', date: 'Jul 07, 9:40 AM' },
  { id: 'FX-590023', dir: 'Inbound', branch: 'Multan Branch', date: 'Jul 06, 6:55 PM' },
  { id: 'FX-590024', dir: 'Outbound', branch: 'Rawalpindi HQ', date: 'Jul 06, 4:20 PM' },
];

export const AGING_PARCELS = [
  { id: 'FX-570091', shelf: 'B-14', days: 6, status: 'Unprocessed' },
  { id: 'FX-570092', shelf: 'C-02', days: 5, status: 'Awaiting RTO' },
  { id: 'FX-570093', shelf: 'A-19', days: 4, status: 'Unprocessed' },
  { id: 'FX-570094', shelf: 'D-07', days: 4, status: 'Awaiting Pickup' },
];

export const STAFF: StaffMember[] = [
  { name: 'Hassan Raza', role: 'Branch Manager', attendance: 'Present', contact: '+92 300 1234567', perm: 'Full Access' },
  { name: 'Owais Farooq', role: 'Dispatch Officer', attendance: 'Present', contact: '+92 301 2345678', perm: 'Dispatch, Transfers' },
  { name: 'Mahnoor Sheikh', role: 'Dispatch Officer', attendance: 'On Leave', contact: '+92 302 3456789', perm: 'Dispatch, Transfers' },
  { name: 'Tayyab Hussain', role: 'Warehouse Staff', attendance: 'Present', contact: '+92 303 4567890', perm: 'Warehouse, Scanning' },
  { name: 'Sadia Gul', role: 'Warehouse Staff', attendance: 'Present', contact: '+92 304 5678901', perm: 'Warehouse, Scanning' },
  { name: 'Noman Afridi', role: 'Customer Support', attendance: 'Present', contact: '+92 305 6789012', perm: 'Tickets, Refunds' },
  { name: 'Rabia Sarwar', role: 'Customer Support', attendance: 'Absent', contact: '+92 306 7890123', perm: 'Tickets, Refunds' },
];

export const ZONES: ZoneCoverage[] = [
  { zone: 'Gulberg / Liberty', codes: '54660–54662', radius: '6 km', sameDay: true, express: true },
  { zone: 'Model Town / Township', codes: '54700–54704', radius: '8 km', sameDay: true, express: true },
  { zone: 'Johar Town / Wapda Town', codes: '54782–54790', radius: '10 km', sameDay: true, express: false },
  { zone: 'DHA Phase 1–8', codes: '54810–54830', radius: '12 km', sameDay: false, express: true },
  { zone: 'Iqbal Town / Faisal Town', codes: '54570–54590', radius: '9 km', sameDay: true, express: false },
  { zone: 'Cantt / Garden Town', codes: '54000–54010', radius: '7 km', sameDay: true, express: true },
];

export const ACTIVITY: ActivityItem[] = [
  { icon: 'box', color: '#2563EB', text: 'Parcel FX-591044 received from Karachi Branch', time: '2 min ago' },
  { icon: 'rider', color: '#1E8E5A', text: 'Rider Bilal Ahmed assigned to pickup PK-70235', time: '8 min ago' },
  { icon: 'truck', color: '#2563EB', text: 'Shipment FX-592012 dispatched to Peshawar Branch', time: '15 min ago' },
  { icon: 'check', color: '#1E8E5A', text: 'Order FX-582011 delivered — OTP confirmed', time: '22 min ago' },
  { icon: 'alert', color: '#D8432C', text: 'Delivery attempt failed for FX-582017 — customer unavailable', time: '34 min ago' },
  { icon: 'return', color: '#F2A93B', text: 'Parcel FX-570092 marked for RTO after 5 days aging', time: '51 min ago' },
  { icon: 'box', color: '#2563EB', text: 'Parcel FX-591046 sorted and shelved at C-02', time: '1 hr ago' },
  { icon: 'rider', color: '#1E8E5A', text: 'Rider Hassan Iqbal came online', time: '1.5 hr ago' },
];

export const ALERTS: AlertItem[] = [
  { sev: 'high', title: 'Storage nearing capacity', msg: 'Warehouse occupancy at 72% — plan additional dispatch runs today.', time: '10 min ago' },
  { sev: 'high', title: '2 unassigned pickups past time slot', msg: 'PK-70233 and PK-70234 have no rider assigned and are past their requested slot.', time: '18 min ago' },
  { sev: 'medium', title: 'Rider overload — Hassan Iqbal', msg: 'Currently assigned 5 active deliveries, above the recommended limit of 4.', time: '40 min ago' },
  { sev: 'medium', title: 'Delayed delivery — FX-582013', msg: 'Out for delivery for over 3 hours without a status update.', time: '55 min ago' },
  { sev: 'low', title: 'Customer complaint logged', msg: 'Complaint #C-4471 regarding late delivery, assigned to support desk.', time: '1 hr ago' },
  { sev: 'low', title: 'Aging parcels flagged', msg: '4 parcels have been in the warehouse for 4+ days without movement.', time: '2 hr ago' },
  { sev: 'medium', title: 'System sync delay', msg: 'Rider GPS feed refreshed with a 90 second delay in the last hour.', time: '2 hr ago' },
];
