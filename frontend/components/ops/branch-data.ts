// Initial-render seed data for the branch console, shown only until the real
// synced data (listStaffOrders/listAllOrders/listStaffRiders) arrives.

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

