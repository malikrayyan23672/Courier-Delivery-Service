import { RoleGuard } from "@/components/RoleGuard";
import Styles from "./page.module.css"
import Script from "next/script";

export default function BranchDashboardPage(){

    return(
        <RoleGuard allowedRoles={['staff']}>
            <BranchDashboardContent/>
        </RoleGuard>
    )
}

function BranchDashboardContent(){


    return (
        <>
        <div className={Styles.shell}>

            <aside className={Styles.sidebar} id="sidebar">
                <div className={Styles.logo}>
                <svg className={Styles.logoMarks} viewBox="0 0 40 40" fill="none">
                    <path d="M2 20 L24 20 L18 12 L34 20 L18 28 L24 20" fill="none" stroke="#2563EB" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round"/>
                </svg>
                <div>
                    <div className={Styles.brand}>FAST<span className={Styles.fx}>EX</span></div>
                    <div className={Styles.brandSub}>BRANCH CONSOLE</div>
                </div>
                </div>

                <div className={Styles.navLabel}>Operations</div>
                <button className={`${Styles.navlink} ${Styles.active}`} data-view="overview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Overview</button>
                <button className={Styles.navlink} data-view="pickups"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 8h-3l-2-3H9L7 8H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z"/><circle cx="12" cy="14" r="3"/></svg>Pickups <span className={Styles.badge} id="navPickup">0</span></button>
                <button className={Styles.navlink} data-view="deliveries"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="15" height="11"/><path d="M16 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18.5" cy="18" r="2"/></svg>Deliveries <span className={Styles.badge} id="navDelivery">0</span></button>
                <button className={Styles.navlink} data-view="parcelops"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h.01M7 12h.01M7 16h.01M11 8h6M11 12h6M11 16h4"/></svg>Parcel Operations</button>
                <button className={Styles.navlink} data-view="warehouse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V9l9-6 9 6v12H3z"/><path d="M9 21v-8h6v8"/></svg>Warehouse</button>

                <div className={Styles.navLabel}>Team</div>
                <button className={Styles.navlink} data-view="riders"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M2 21c0-3.5 2.5-6 6-6M22 21c0-3.5-2.5-6-6-6"/><circle cx="12" cy="15" r="3"/><path d="M6 21c0-3 2.7-5 6-5s6 2 6 5"/></svg>Riders <span className={Styles.badge} id="navRiders">0</span></button>
                <button className={Styles.navlink} data-view="staff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>Staff</button>

                <div className={Styles.navLabel}>Coverage</div>
                <button className={Styles.navlink} data-view="servicearea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>Service Area</button>
                <button className={Styles.navlink} data-view="map"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3z"/><path d="M8 3v15M16 6v15"/></svg>Live Map</button>

                <div className={Styles.navLabel}>Insights</div>
                <button className={Styles.navlink} data-view="reports"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>Reports</button>
                <button className={Styles.navlink} data-view="alerts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>Alerts <span className={`${Styles.badge} ${Styles.alert}`} id="navAlerts">0</span></button>

                <div className={Styles.sidebarFoot}>Lahore Central Branch
                    <b style={{color:'rgba(255,255,255,.7)'}}>LHE-CTR-01 · Punjab Region</b>
                </div>
            </aside>

            <div className={Styles.main}>
                <div className={Styles.topbar}>
                <button className={Styles.menuBtn} id="menuBtn" aria-label="Toggle menu"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
                <div>
                    <h1 id="pageTitle">Overview</h1>
                    <div className={Styles.sub} id="pageSub">Lahore Central Branch · live operational snapshot</div>
                </div>
                <div className={Styles.topActions}>
                    <button className={Styles.iconBtn} id="bellBtn" title="Alerts">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    <span className={Styles.dot} id="bellCount">0</span>
                    </button>
                    <button className={Styles.btnPrimary} data-goto="pickups">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                    New Pickup Request
                    </button>
                </div>
                </div>

                <div className={Styles.content}>

                <div className={`${Styles.view} ${Styles.active}`} data-panel="overview">

                    <div className={Styles.branchHeader}>
                    <div className={Styles.bhMain}>
                        <div className={Styles.bhTop}>
                        <h2>Lahore Central Branch</h2>
                        <span className={`${Styles.bhPill} ${Styles.statusActive}`} id="statusPill">● Active</span>
                        <span className={Styles.bhPill}>Regional Hub</span>
                        </div>
                        <div className={Styles.bhCode}>Branch Code: LHE-CTR-01</div>
                        <div className={Styles.bhAddr}>12-B, Gulberg III, Main Boulevard, Lahore, Punjab, Pakistan — serving Lahore metro and surrounding districts.</div>
                        <a className={Styles.bhMapLink} href="https://www.google.com/maps/search/?api=1&query=12-B%20Gulberg%20III%20Main%20Boulevard%20Lahore%20Pakistan" target="_blank" rel="noopener">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
                        Open in Google Maps
                        </a>
                        <div className={Styles.bhGrid} style={{marginTop: '18px'}}>
                        <div className={Styles.bhItem}><div className={Styles.bhLbl}>Working Hours</div><div className={Styles.bhVal}>Mon–Sat · 8:00 AM – 10:00 PM</div></div>
                        <div className={Styles.bhItem}><div className={Styles.bhLbl}>Branch Type</div><div className={Styles.bhVal}>Regional Hub / Delivery Branch</div></div>
                        <div className={Styles.bhItem}><div className={Styles.bhLbl}>Today's Status</div><div className={Styles.bhVal}>Operating normally · 2 alerts to review</div></div>
                        </div>
                    </div>
                    <div className={Styles.bhSide}>
                        <div className={Styles.bhStatusTitle}>Branch Manager</div>
                        <div className={Styles.bhManager}>
                        <div className={Styles.av}>HR</div>
                        <div>
                            <div className={Styles.mName}>Hassan Raza</div>
                            <div className={Styles.mContact}>+92 300 1234567 · hassan.raza@fastex.pk</div>
                        </div>
                        </div>
                        <p style={{marginTop:'14px'}}>On-site since 6:45 AM. Reachable on radio channel 3 for escalations.</p>
                    </div>
                    </div>

                    <div className={Styles.kpiGrid} id="kpiGrid"></div>

                    <div className={Styles.twoCol}>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Recent Activity</h2><div className={Styles.bSub}>Real-time events across the branch</div></div></div>
                        <div className={Styles.timeline} id="timelineList"></div>
                    </section>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Quick Actions</h2><div className={Styles.bSub}>Common branch tasks</div></div></div>
                        <div className={Styles.qaGrid} id="qaGrid"></div>
                    </section>
                    </div>

                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Priority Alerts</h2><div className={Styles.bSub}>Needs branch manager attention</div></div><button className={`${Styles.btnSm} ${Styles.ghost}`} data-goto="alerts">View all →</button></div>
                    <div className={Styles.blockBody} id="alertPreview"></div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="pickups">
                    <section className={Styles.block}>
                    <div className={Styles.statStrip} id="pickupStrip"></div>
                    <div className={Styles.blockBody} style={{paddingBottom:'0'}}>
                        <div className={Styles.ssLbl} style={{marginBottom:'6px'}}>Pickup completion today</div>
                        <div className={Styles.progressLine}><div id="pickupProgress" style={{width:'0%'}}></div></div>
                    </div>
                    <div className={Styles.filterRow}>
                        <div className={Styles.frSearch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                        <input type="text" id="pickupSearch" placeholder="Search customer or zone…"/>
                        </div>
                        <select id="pickupStatusFilter"><option value="">Any status</option><option>Pending</option><option>Assigned</option><option>Picked Up</option><option>Failed</option></select>
                    </div>
                    <div className={Styles.tableScroll}>
                        <table id="pickupTable"><thead><tr>
                        <th>Pickup ID</th><th>Customer / Location</th><th>Time Slot</th><th>Assigned Rider</th><th>Rider Status</th><th>Status</th><th>Action</th>
                        </tr></thead><tbody></tbody></table>
                    </div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="deliveries">
                    <section className={Styles.block}>
                    <div className={Styles.statStrip} id="deliveryStrip"></div>
                    <div className={Styles.filterRow}>
                        <div className={Styles.frSearch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                        <input type="text" id="deliverySearch" placeholder="Search customer or order ID…"/>
                        </div>
                        <select id="deliveryStatusFilter"><option value="">Any status</option><option>Ready</option><option>Out for Delivery</option><option>Delivered</option><option>Failed</option><option>Rescheduled</option></select>
                    </div>
                    <div className={Styles.tableScroll}>
                        <table id="deliveryTable"><thead><tr>
                        <th>Order ID</th><th>Customer / Zone</th><th>Assigned Rider</th><th>Progress</th><th>Status</th><th>Proof</th><th>Action</th>
                        </tr></thead><tbody></tbody></table>
                    </div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="parcelops">
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Scan Parcel</h2><div className={Styles.bSub}>Simulate barcode / QR scan for incoming or outgoing parcels</div></div></div>
                    <div className={Styles.scanBox}>
                        <input type="text" id="scanInput" placeholder="Enter or scan tracking barcode…"/>
                        <button className={Styles.btnPrimary} id="scanInBtn">Scan Incoming</button>
                        <button className={`${Styles.btnSm} ${Styles.ghost}`} id="scanOutBtn" style={{padding:'9px 16px'}}>Scan Outgoing</button>
                    </div>
                    <div className={Styles.scanLog} id="scanLog"></div>
                    </section>

                    <div className={Styles.twoCol}>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Receiving Queue</h2><div className={Styles.bSub}>Awaiting sort</div></div></div>
                        <div className={Styles.tableScroll}><table id="receivingTable"><thead><tr><th>Tracking ID</th><th>From Branch</th><th>Sorting Status</th></tr></thead><tbody></tbody></table></div>
                    </section>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Dispatch Queue</h2><div className={Styles.bSub}>Ready to leave the branch</div></div></div>
                        <div className={Styles.tableScroll}><table id="dispatchTable"><thead><tr><th>Tracking ID</th><th>To Branch</th><th>Dispatch Status</th></tr></thead><tbody></tbody></table></div>
                    </section>
                    </div>

                    <section className={Styles.block}>
                    <div className={Styles.blockHead}>
                        <div><h2>Transfer History</h2><div className={Styles.bSub}>Inter-branch parcel movements</div></div>
                        <div style={{display:'flex', gap:'8px'}}>
                        <button className={`${Styles.btnSm} ${Styles.ghost}`} id="reportDamagedBtn">Report Damaged</button>
                        <button className={`${Styles.btnSm} ${Styles.ghost}`} id="reportMissingBtn">Report Missing</button>
                        </div>
                    </div>
                    <div className={Styles.tableScroll}><table id="transferTable"><thead><tr><th>Tracking ID</th><th>Direction</th><th>Branch</th><th>Date</th></tr></thead><tbody></tbody></table></div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="warehouse">
                    <div className={Styles.twoCol}>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Storage Capacity</h2><div className={Styles.bSub}>Rack occupancy across the warehouse floor</div></div></div>
                        <div className={Styles.shelfGrid} id="shelfGrid"></div>
                        <div className={Styles.shelfLegend}>
                        <span><i style={{background:'var(--success-tint)', border:'1px solid var(--success)'}}></i>Low occupancy</span>
                        <span><i style={{background:'var(--warn-tint)', border:'1px solid var(--warn)'}}></i>Mid occupancy</span>
                        <span><i style={{background:'var(--danger-tint)', border:'1px solid var(--danger)'}}></i>Near capacity</span>
                        </div>
                    </section>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Capacity Usage</h2></div></div>
                        <div className={Styles.blockBody}>
                        <div className={Styles.donutWrap}>
                            <div className={Styles.donut} id="capacityDonut"><div className={Styles.donutHole}><b id="capacityPct">72%</b><span>used</span></div></div>
                            <ul className={Styles.legendList}>
                            <li><i style={{background:'var(--blue-600)'}}></i>Occupied <b>72%</b></li>
                            <li><i style={{background:'var(--gray-tint)', border:'1px solid var(--border)'}}></i>Free <b>28%</b></li>
                            </ul>
                        </div>
                        <div className={Styles.statStrip} id="warehouseStrip" style={{border:'none', padding:'18px 0 0'}}></div>
                        </div>
                    </section>
                    </div>
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Aging Parcels</h2><div className={Styles.bSub}>Parcels sitting longest without movement</div></div></div>
                    <div className={Styles.tableScroll}><table id="agingTable"><thead><tr><th>Tracking ID</th><th>Shelf Location</th><th>Days in Warehouse</th><th>Status</th></tr></thead><tbody></tbody></table></div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="riders">
                    <div className={Styles.statStrip} id="riderStrip" style={{background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', marginBottom:'18px'}}></div>
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Rider Roster</h2><div className={Styles.bSub}>Availability, live status and performance</div></div></div>
                    <div className={Styles.riderGrid} id="riderGrid"></div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="staff">
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Branch Staff</h2><div className={Styles.bSub}>Roles, attendance and permissions</div></div><button className={Styles.btnSm}>+ Add Staff</button></div>
                    <div className={Styles.tableScroll}>
                        <table id="staffTable"><thead><tr><th>Name</th><th>Role</th><th>Attendance</th><th>Contact</th><th>Permissions</th></tr></thead><tbody></tbody></table>
                    </div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="servicearea">
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Coverage Zones</h2><div className={Styles.bSub}>Cities, postal codes and delivery capabilities served by this branch</div></div></div>
                    <div className={Styles.tableScroll}>
                        <table id="zoneTable"><thead><tr><th>Zone</th><th>Postal Codes</th><th>Delivery Radius</th><th>Same-Day</th><th>Express</th></tr></thead><tbody></tbody></table>
                    </div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="map">
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}>
                        <div><h2>Live Operations Map</h2><div className={Styles.bSub}>Branch, riders, pickups and deliveries in real time</div></div>
                        <span className={`${Styles.pill} ${Styles.amber}`} id="trafficPill">Moderate traffic</span>
                    </div>
                    <div className={Styles.mapWrap} id="mapWrap"></div>
                    <div className={Styles.mapLegend}>
                        <span><i style={{background:'var(--ink)'}}></i>Branch</span>
                        <span><i style={{background:'var(--blue-600)'}}></i>Rider (active route)</span>
                        <span><i style={{background:'var(--faint)'}}></i>Rider (idle)</span>
                        <span><i style={{background:'var(--warn)'}}></i>Pickup location</span>
                        <span><i style={{background:'var(--success)'}}></i>Delivery location</span>
                    </div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="reports">
                    <div className={Styles.twoCol}>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Shipments — Last 7 Days</h2></div></div>
                        <div className={Styles.barChart} id="weeklyChart"></div>
                    </section>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Delivery Success Rate</h2></div></div>
                        <div className={Styles.blockBody}>
                        <div className={Styles.donutWrap}>
                            <div className={Styles.donut} id="successDonut"><div className={Styles.donutHole}><b id="successPct">91%</b><span>success</span></div></div>
                            <ul className={Styles.legendList}>
                            <li><i style={{background:'var(--success)'}}></i>Delivered <b>91%</b></li>
                            <li><i style={{background:'var(--danger)'}}></i>Failed <b>5%</b></li>
                            <li><i style={{background:'var(--faint)'}}></i>Returned <b>4%</b></li>
                            </ul>
                        </div>
                        </div>
                    </section>
                    </div>

                    <div className={Styles.twoCol}>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Rider Productivity</h2><div className={Styles.bSub}>Top performers this week</div></div></div>
                        <div className={Styles.tableScroll}><table id="productivityTable"><thead><tr><th>Rider</th><th>Deliveries</th><th>Success Rate</th><th>Avg Time</th></tr></thead><tbody></tbody></table></div>
                    </section>
                    <section className={Styles.block}>
                        <div className={Styles.blockHead}><div><h2>Branch vs. Network Average</h2></div></div>
                        <div className={Styles.blockBody} id="cmpBody"></div>
                    </section>
                    </div>

                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Summary Metrics</h2></div></div>
                    <div className={Styles.statStrip} id="reportStrip"></div>
                    </section>
                </div>

                <div className={Styles.view} data-panel="alerts">
                    <section className={Styles.block}>
                    <div className={Styles.blockHead}><div><h2>Alerts & Notifications</h2><div className={Styles.bSub}>Everything flagged for branch manager review</div></div></div>
                    <div className={Styles.blockBody} id="alertFull"></div>
                    </section>
                </div>

                </div>
            </div>
            </div>

            <div className={Styles.toastWrap} id="toastWrap"></div>

            <Script onLoad={
                () => {
                    
  // ==================================================================
  // MOCK DATA
  // ==================================================================
  const riders = [
    {name:'Bilal Ahmed', vehicle:'Bike · LEA-2214', status:'online', busy:false, score:4.8, success:96, deliveries:14, gps:'31.520, 74.345 · Gulberg'},
    {name:'Ayesha Khan', vehicle:'Bike · LEB-9931', status:'busy', busy:true, score:4.6, success:93, deliveries:11, gps:'31.498, 74.331 · Model Town'},
    {name:'Hassan Iqbal', vehicle:'Van · LED-4471', status:'busy', busy:true, score:4.9, success:97, deliveries:18, gps:'31.552, 74.360 · Johar Town'},
    {name:'Zeeshan Tariq', vehicle:'Bike · LEC-3382', status:'offline', busy:false, score:4.2, success:88, deliveries:6, gps:'Off duty since 4:10 PM'},
    {name:'Sana Malik', vehicle:'Bike · LEA-1187', status:'online', busy:false, score:4.7, success:95, deliveries:12, gps:'31.507, 74.352 · Liberty'},
    {name:'Usman Ghani', vehicle:'Van · LEE-6620', status:'busy', busy:true, score:4.5, success:91, deliveries:16, gps:'31.480, 74.300 · Township'},
    {name:'Rimsha Aslam', vehicle:'Bike · LEB-7745', status:'online', busy:false, score:4.4, success:90, deliveries:9, gps:'31.540, 74.370 · DHA Phase 5'},
    {name:'Danish Butt', vehicle:'Bike · LEC-2298', status:'busy', busy:true, score:4.6, success:94, deliveries:13, gps:'31.515, 74.320 · Garden Town'},
    {name:'Fahad Sheikh', vehicle:'Bike · LED-5561', status:'offline', busy:false, score:4.1, success:86, deliveries:5, gps:'Off duty since 2:30 PM'},
    {name:'Nida Bibi', vehicle:'Bike · LEA-8834', status:'online', busy:false, score:4.8, success:97, deliveries:15, gps:'31.560, 74.340 · Faisal Town'},
    {name:'Kamran Shah', vehicle:'Van · LEF-1123', status:'busy', busy:true, score:4.3, success:89, deliveries:17, gps:'31.490, 74.310 · Wapda Town'},
    {name:'Farah Naz', vehicle:'Bike · LEB-6602', status:'online', busy:false, score:4.9, success:98, deliveries:10, gps:'31.530, 74.380 · Iqbal Town'},
  ];

  const pickups = [
    {id:'PK-70231', customer:'Ahmed Traders', zone:'Gulberg III', slot:'10:00–11:00 AM', rider:'Bilal Ahmed', arrival:'Arrived', status:'Picked Up'},
    {id:'PK-70232', customer:'Ayesha Boutique', zone:'Model Town', slot:'11:00–12:00 PM', rider:'Ayesha Khan', arrival:'En Route', status:'Assigned'},
    {id:'PK-70233', customer:'Prime Electronics', zone:'Johar Town', slot:'12:00–1:00 PM', rider:null, arrival:'Not Started', status:'Pending'},
    {id:'PK-70234', customer:'Zara Home Store', zone:'DHA Phase 5', slot:'1:00–2:00 PM', rider:null, arrival:'Not Started', status:'Pending'},
    {id:'PK-70235', customer:'Bilal General Store', zone:'Township', slot:'2:00–3:00 PM', rider:'Usman Ghani', arrival:'Arrived', status:'Picked Up'},
    {id:'PK-70236', customer:'Sitara Fashion', zone:'Garden Town', slot:'3:00–4:00 PM', rider:'Danish Butt', arrival:'En Route', status:'Assigned'},
    {id:'PK-70237', customer:'Al-Fateh Mart', zone:'Faisal Town', slot:'9:00–10:00 AM', rider:'Nida Bibi', arrival:'Arrived', status:'Failed', fail:'Store closed on arrival'},
    {id:'PK-70238', customer:'Rehman Books', zone:'Iqbal Town', slot:'4:00–5:00 PM', rider:null, arrival:'Not Started', status:'Pending'},
    {id:'PK-70239', customer:'Noor Cosmetics', zone:'Liberty Market', slot:'10:30–11:30 AM', rider:'Sana Malik', arrival:'Arrived', status:'Picked Up'},
    {id:'PK-70240', customer:'City Pharma', zone:'Wapda Town', slot:'5:00–6:00 PM', rider:'Kamran Shah', arrival:'En Route', status:'Assigned'},
  ];

  const deliveries = [
    {id:'FX-582011', customer:'Kashif Raza', zone:'Gulberg III', rider:'Bilal Ahmed', progress:100, status:'Delivered', proof:'OTP'},
    {id:'FX-582012', customer:'Mehwish Ali', zone:'Model Town', rider:'Ayesha Khan', progress:65, status:'Out for Delivery', proof:'—'},
    {id:'FX-582013', customer:'Owais Tariq', zone:'Johar Town', rider:'Hassan Iqbal', progress:40, status:'Out for Delivery', proof:'—'},
    {id:'FX-582014', customer:'Sana Yousaf', zone:'DHA Phase 5', rider:null, progress:0, status:'Ready', proof:'—'},
    {id:'FX-582015', customer:'Imran Chaudhry', zone:'Township', rider:'Usman Ghani', progress:80, status:'Out for Delivery', proof:'—'},
    {id:'FX-582016', customer:'Faryal Shah', zone:'Garden Town', rider:'Danish Butt', progress:100, status:'Delivered', proof:'Signature'},
    {id:'FX-582017', customer:'Adeel Mirza', zone:'Faisal Town', rider:'Nida Bibi', progress:100, status:'Failed', proof:'—'},
    {id:'FX-582018', customer:'Hira Baig', zone:'Iqbal Town', rider:null, progress:0, status:'Ready', proof:'—'},
    {id:'FX-582019', customer:'Waleed Aslam', zone:'Liberty Market', rider:'Sana Malik', progress:100, status:'Delivered', proof:'Photo'},
    {id:'FX-582020', customer:'Zoya Naeem', zone:'Wapda Town', rider:'Kamran Shah', progress:55, status:'Out for Delivery', proof:'—'},
    {id:'FX-582021', customer:'Bilal Sarwar', zone:'Gulberg II', rider:'Farah Naz', progress:100, status:'Delivered', proof:'OTP'},
    {id:'FX-582022', customer:'Nimra Javed', zone:'Cantt', rider:null, progress:0, status:'Ready', proof:'—'},
  ];

  const receivingQueue = [
    {id:'FX-591044', from:'Karachi Branch', sort:'In Progress'},
    {id:'FX-591045', from:'Islamabad Branch', sort:'Pending'},
    {id:'FX-591046', from:'Faisalabad Branch', sort:'Sorted'},
    {id:'FX-591047', from:'Multan Branch', sort:'Pending'},
  ];
  const dispatchQueue = [
    {id:'FX-592011', to:'Rawalpindi HQ', status:'Ready to Load'},
    {id:'FX-592012', to:'Peshawar Branch', status:'Loading'},
    {id:'FX-592013', to:'Quetta Branch', status:'Ready to Load'},
  ];
  const transferHistory = [
    {id:'FX-590021', dir:'Inbound', branch:'Karachi Branch', date:'Jul 07, 8:12 AM'},
    {id:'FX-590022', dir:'Outbound', branch:'Islamabad Branch', date:'Jul 07, 9:40 AM'},
    {id:'FX-590023', dir:'Inbound', branch:'Multan Branch', date:'Jul 06, 6:55 PM'},
    {id:'FX-590024', dir:'Outbound', branch:'Rawalpindi HQ', date:'Jul 06, 4:20 PM'},
  ];

  const agingParcels = [
    {id:'FX-570091', shelf:'B-14', days:6, status:'Unprocessed'},
    {id:'FX-570092', shelf:'C-02', days:5, status:'Awaiting RTO'},
    {id:'FX-570093', shelf:'A-19', days:4, status:'Unprocessed'},
    {id:'FX-570094', shelf:'D-07', days:4, status:'Awaiting Pickup'},
  ];

  const staff = [
    {name:'Hassan Raza', role:'Branch Manager', attendance:'Present', contact:'+92 300 1234567', perm:'Full Access'},
    {name:'Owais Farooq', role:'Dispatch Officer', attendance:'Present', contact:'+92 301 2345678', perm:'Dispatch, Transfers'},
    {name:'Mahnoor Sheikh', role:'Dispatch Officer', attendance:'On Leave', contact:'+92 302 3456789', perm:'Dispatch, Transfers'},
    {name:'Tayyab Hussain', role:'Warehouse Staff', attendance:'Present', contact:'+92 303 4567890', perm:'Warehouse, Scanning'},
    {name:'Sadia Gul', role:'Warehouse Staff', attendance:'Present', contact:'+92 304 5678901', perm:'Warehouse, Scanning'},
    {name:'Noman Afridi', role:'Customer Support', attendance:'Present', contact:'+92 305 6789012', perm:'Tickets, Refunds'},
    {name:'Rabia Sarwar', role:'Customer Support', attendance:'Absent', contact:'+92 306 7890123', perm:'Tickets, Refunds'},
  ];

  const zones = [
    {zone:'Gulberg / Liberty', codes:'54660–54662', radius:'6 km', sameDay:true, express:true},
    {zone:'Model Town / Township', codes:'54700–54704', radius:'8 km', sameDay:true, express:true},
    {zone:'Johar Town / Wapda Town', codes:'54782–54790', radius:'10 km', sameDay:true, express:false},
    {zone:'DHA Phase 1–8', codes:'54810–54830', radius:'12 km', sameDay:false, express:true},
    {zone:'Iqbal Town / Faisal Town', codes:'54570–54590', radius:'9 km', sameDay:true, express:false},
    {zone:'Cantt / Garden Town', codes:'54000–54010', radius:'7 km', sameDay:true, express:true},
  ];

  const activity = [
    {icon:'box', color:'var(--blue-600)', text:'Parcel FX-591044 received from Karachi Branch', time:'2 min ago'},
    {icon:'rider', color:'var(--success)', text:'Rider Bilal Ahmed assigned to pickup PK-70235', time:'8 min ago'},
    {icon:'truck', color:'var(--blue-600)', text:'Shipment FX-592012 dispatched to Peshawar Branch', time:'15 min ago'},
    {icon:'check', color:'var(--success)', text:'Order FX-582011 delivered — OTP confirmed', time:'22 min ago'},
    {icon:'alert', color:'var(--danger)', text:'Delivery attempt failed for FX-582017 — customer unavailable', time:'34 min ago'},
    {icon:'return', color:'var(--warn)', text:'Parcel FX-570092 marked for RTO after 5 days aging', time:'51 min ago'},
    {icon:'box', color:'var(--blue-600)', text:'Parcel FX-591046 sorted and shelved at C-02', time:'1 hr ago'},
    {icon:'rider', color:'var(--success)', text:'Rider Hassan Iqbal came online', time:'1.5 hr ago'},
  ];

  const alertsData = [
    {sev:'high', title:'Storage nearing capacity', msg:'Warehouse occupancy at 72% — plan additional dispatch runs today.', time:'10 min ago'},
    {sev:'high', title:'2 unassigned pickups past time slot', msg:'PK-70233 and PK-70234 have no rider assigned and are past their requested slot.', time:'18 min ago'},
    {sev:'medium', title:'Rider overload — Hassan Iqbal', msg:'Currently assigned 5 active deliveries, above the recommended limit of 4.', time:'40 min ago'},
    {sev:'medium', title:'Delayed delivery — FX-582013', msg:'Out for delivery for over 3 hours without a status update.', time:'55 min ago'},
    {sev:'low', title:'Customer complaint logged', msg:'Complaint #C-4471 regarding late delivery, assigned to support desk.', time:'1 hr ago'},
    {sev:'low', title:'Aging parcels flagged', msg:'4 parcels have been in the warehouse for 4+ days without movement.', time:'2 hr ago'},
    {sev:'medium', title:'System sync delay', msg:'Rider GPS feed refreshed with a 90 second delay in the last hour.', time:'2 hr ago'},
  ];

  const scanLogData: { id: any; type: any; time: string; }[] = [];

  // ==================================================================
  // HELPERS
  // ==================================================================
  function initials(name: string){ return name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase(); }
  function toast(msg: string | null){
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.getElementById('toastWrap')!.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2600);
  }
  function pillClass(status: string){
    const map: { [key: string]: string } = {Pending:'gray', Assigned:'amber', 'Picked Up':'green', Failed:'red', Ready:'gray',
      'Out for Delivery':'amber', Delivered:'green', Rescheduled:'blue', 'En Route':'amber', Arrived:'green', 'Not Started':'gray'};
    return map[status] || 'gray';
  }
  const icons: { [key: string]: string } = {
    box:'<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    truck:'<rect x="1" y="6" width="15" height="11"/><path d="M16 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18.5" cy="18" r="2"/>',
    rider:'<circle cx="12" cy="7" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
    alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    dollar:'<circle cx="12" cy="12" r="9"/><path d="M12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.5 6 4.5 0 1.4-1.3 2.4-3 2.4s-3-1-3-2.4"/>',
    warehouse:'<path d="M3 21V9l9-6 9 6v12H3z"/><path d="M9 21v-8h6v8"/>',
    inbound:'<path d="M12 5v14M5 12l7 7 7-7"/>',
    outbound:'<path d="M12 19V5M5 12l7-7 7 7"/>',
    return:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    riders2:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M2 21c0-3.5 2.5-6 6-6M22 21c0-3.5-2.5-6-6-6"/><circle cx="12" cy="15" r="3"/><path d="M6 21c0-3 2.7-5 6-5s6 2 6 5"/>',
  };
  function svgIcon(name: string, size: number){ size = size||16; return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">${icons[name]}</svg>`; }

  // ==================================================================
  // KPI GRID
  // ==================================================================
  function kpiValues(){
    return [
      {icon:'box', bg:'var(--blue-600)', label:'Total Shipments Today', num:412, trend:'+8% vs yesterday', cls:'up'},
      {icon:'clock', bg:'var(--warn)', label:'Pending Pickups', num:pickups.filter(p=>p.status==='Pending').length, trend:'Needs assignment', cls:'warn'},
      {icon:'check', bg:'var(--success)', label:'Picked Up Parcels', num:pickups.filter(p=>p.status==='Picked Up').length, trend:'On schedule', cls:'up'},
      {icon:'inbound', bg:'var(--blue-600)', label:'Incoming Shipments', num:140, trend:'From 6 branches', cls:'up'},
      {icon:'outbound', bg:'var(--blue-600)', label:'Outgoing Shipments', num:158, trend:'To 7 branches', cls:'up'},
      {icon:'truck', bg:'var(--warn)', label:'Out for Delivery', num:deliveries.filter(d=>d.status==='Out for Delivery').length, trend:'87 riders en route', cls:'warn'},
      {icon:'check', bg:'var(--success)', label:'Delivered Orders', num:deliveries.filter(d=>d.status==='Delivered').length, trend:'91% success rate', cls:'up'},
      {icon:'alert', bg:'var(--danger)', label:'Failed Deliveries', num:deliveries.filter(d=>d.status==='Failed').length, trend:'Review reasons', cls:'down'},
      {icon:'return', bg:'var(--muted)', label:'Returned Parcels (RTO)', num:9, trend:'2.2% of volume', cls:'warn'},
      {icon:'dollar', bg:'var(--success)', label:'COD Collection', num:'Rs 486,300', trend:'96% reconciled', cls:'up'},
      {icon:'riders2', bg:'var(--success)', label:'Available Riders', num:riders.filter(r=>r.status==='online').length, trend:'Ready for dispatch', cls:'up'},
      {icon:'riders2', bg:'var(--warn)', label:'Busy Riders', num:riders.filter(r=>r.status==='busy').length, trend:'On active routes', cls:'warn'},
      {icon:'warehouse', bg:'var(--blue-700)', label:'Warehouse Capacity', num:'72%', trend:'Approaching limit', cls:'warn'},
    ];
  }
  function renderKpis(){
    document.getElementById('kpiGrid')!.innerHTML = kpiValues().map(k => `
      <div class="kpi-card">
        <div class="kpi-top"><div class="kpi-icon" style="background:${k.bg}">${svgIcon(k.icon,15)}</div></div>
        <div class="kpi-num">${k.num}</div>
        <div class="kpi-lbl">${k.label}</div>
        <div class="kpi-trend ${k.cls}">${k.trend}</div>
      </div>
    `).join('');
  }

  // ==================================================================
  // TIMELINE / ALERTS PREVIEW
  // ==================================================================
  function renderTimeline(){
    document.getElementById('timelineList')!.innerHTML = activity.map(a => `
      <div class="tl-item">
        <div class="tl-icon" style="background:${a.color}">${svgIcon(a.icon,14)}</div>
        <div><div class="tl-text">${a.text}</div></div>
        <div class="tl-time">${a.time}</div>
      </div>
    `).join('');
  }
  function alertCardHTML(a: { sev: any; title: any; msg: any; time: any; }){
    return `
      <div class="alert-card ${a.sev}">
        <div class="alert-icon">${svgIcon('alert',15)}</div>
        <div>
          <div class="alert-title">${a.title}</div>
          <div class="alert-msg">${a.msg}</div>
          <div class="alert-time">${a.time}</div>
        </div>
      </div>`;
  }
  function renderAlerts(){
    document.getElementById('alertPreview')!.innerHTML = alertsData.slice(0,3).map(alertCardHTML).join('');
    document.getElementById('alertFull')!.innerHTML = alertsData.map(alertCardHTML).join('');
    document.getElementById('navAlerts')!.textContent = String(alertsData.length);
    document.getElementById('bellCount')!.textContent = String(alertsData.length);
  }

  // ==================================================================
  // QUICK ACTIONS
  // ==================================================================
  const quickActions = [
    {icon:'clock', label:'Create Pickup Request', msg:'Pickup request created.'},
    {icon:'riders2', label:'Assign Rider', msg:'Rider assignment panel opened.'},
    {icon:'box', label:'Scan Parcel', msg:'Redirecting to Parcel Operations…', goto:'parcelops'},
    {icon:'truck', label:'Dispatch Shipment', msg:'Shipment queued for dispatch.'},
    {icon:'outbound', label:'Transfer Shipment', msg:'Transfer request started.'},
    {icon:'check', label:'Add Staff', msg:'New staff form opened.', goto:'staff'},
    {icon:'warehouse', label:'Add Vehicle', msg:'Vehicle registration started.'},
    {icon:'return', label:'Generate Report', msg:'Report generation started — check Reports.', goto:'reports'},
  ];
  function renderQuickActions(){
    document.getElementById('qaGrid')!.innerHTML = quickActions.map((q,i) => `
      <button class="qa-btn" data-qa="${i}"><div class="qa-icon">${svgIcon(q.icon,17).replace('stroke="#fff"','stroke="currentColor"')}</div><span>${q.label}</span></button>
    `).join('');
    document.querySelectorAll('[data-qa]').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        // @ts-ignore dataset typing
        const q = quickActions[(btn as HTMLElement).dataset.qa as unknown as number];
        toast(q.msg);
        if(q.goto) switchView(q.goto);
      });
    });
  }

  // ==================================================================
  // PICKUPS
  // ==================================================================
  function renderPickupStrip(){
    const total = pickups.length;
    const pending = pickups.filter(p=>p.status==='Pending').length;
    const assigned = pickups.filter(p=>p.status==='Assigned').length;
    const done = pickups.filter(p=>p.status==='Picked Up').length;
    const failed = pickups.filter(p=>p.status==='Failed').length;
    document.getElementById('pickupStrip')!.innerHTML = `
      <div class="ss-item"><div class="ss-num">${total}</div><div class="ss-lbl">Today's Requests</div></div>
      <div class="ss-item"><div class="ss-num">${pending}</div><div class="ss-lbl">Pending Assignment</div></div>
      <div class="ss-item"><div class="ss-num">${assigned}</div><div class="ss-lbl">Rider Assigned</div></div>
      <div class="ss-item"><div class="ss-num">${done}</div><div class="ss-lbl">Picked Up</div></div>
      <div class="ss-item"><div class="ss-num">${failed}</div><div class="ss-lbl">Failed Attempts</div></div>
    `;
    (document.getElementById('pickupProgress') as HTMLElement)!.style.width = Math.round(done/total*100) + '%';
  }
  function renderPickupTable(){
    const q = (document.getElementById('pickupSearch') as HTMLInputElement)!.value.trim().toLowerCase();
    const statusF = (document.getElementById('pickupStatusFilter') as HTMLSelectElement)!.value;
    const rows = pickups.filter(p => {
      if(statusF && p.status !== statusF) return false;
      if(q && !(p.customer.toLowerCase().includes(q) || p.zone.toLowerCase().includes(q))) return false;
      return true;
    });
    (document.querySelector('#pickupTable tbody') as HTMLElement)!.innerHTML = rows.map(p => `
      <tr>
        <td class="cell-id mono">${p.id}</td>
        <td>${p.customer}<div class="cell-sub">${p.zone}</div></td>
        <td>${p.slot}</td>
        <td>${p.rider ? `<div class="avatar-chip"><div class="av">${initials(p.rider)}</div><div class="av-name">${p.rider}</div></div>` : `<div class="avatar-chip unassigned"><div class="av">–</div><div class="av-name">Unassigned</div></div>`}</td>
        <td>${p.rider ? `<span class="pill ${pillClass(p.arrival)}">${p.arrival}</span>` : '—'}</td>
        <td><span class="pill ${pillClass(p.status)}">${p.status}</span>${p.fail ? `<div class="cell-sub">${p.fail}</div>` : ''}</td>
        <td>${p.status==='Pending' ? `<button class="btn-sm" data-assign-pickup="${p.id}">Quick Assign</button>` : '<span class="cell-sub">—</span>'}</td>
      </tr>
    `).join('');
    document.querySelectorAll('[data-assign-pickup]').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.assignPickup as string;
        const p = pickups.find(x => x.id === id);
        const free = riders.find(r => r.status === 'online');
        if(free && p){ p.rider = free.name; p.arrival = 'En Route'; p.status = 'Assigned'; toast(`${free.name} assigned to ${p.id}`); }
        else toast('No available rider right now.');
        renderPickupStrip(); renderPickupTable(); renderKpis();
      });
    });
    document.getElementById('navPickup')!.textContent = String(pickups.filter(p=>p.status==='Pending').length);
  }

  // ==================================================================
  // DELIVERIES
  // ==================================================================
  function renderDeliveryStrip(){
    const ready = deliveries.filter(d=>d.status==='Ready').length;
    const out = deliveries.filter(d=>d.status==='Out for Delivery').length;
    const done = deliveries.filter(d=>d.status==='Delivered').length;
    const failed = deliveries.filter(d=>d.status==='Failed').length;
    document.getElementById('deliveryStrip')!.innerHTML = `
      <div class="ss-item"><div class="ss-num">${ready}</div><div class="ss-lbl">Ready for Delivery</div></div>
      <div class="ss-item"><div class="ss-num">${out}</div><div class="ss-lbl">Out for Delivery</div></div>
      <div class="ss-item"><div class="ss-num">${done}</div><div class="ss-lbl">Completed</div></div>
      <div class="ss-item"><div class="ss-num">${failed}</div><div class="ss-lbl">Failed Attempts</div></div>
    `;
  }
  function renderDeliveryTable(){
    const q = (document.getElementById('deliverySearch') as HTMLInputElement)!.value.trim().toLowerCase();
    const statusF = (document.getElementById('deliveryStatusFilter') as HTMLSelectElement)!.value;
    const rows = deliveries.filter(d => {
      if(statusF && d.status !== statusF) return false;
      if(q && !(d.customer.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))) return false;
      return true;
    });
    (document.querySelector('#deliveryTable tbody') as HTMLElement)!.innerHTML = rows.map(d => `
      <tr>
        <td class="cell-id mono">${d.id}</td>
        <td>${d.customer}<div class="cell-sub">${d.zone}</div></td>
        <td>${d.rider ? `<div class="avatar-chip"><div class="av">${initials(d.rider)}</div><div class="av-name">${d.rider}</div></div>` : `<div class="avatar-chip unassigned"><div class="av">–</div><div class="av-name">Unassigned</div></div>`}</td>
        <td style="min-width:110px;"><div class="progress-line"><div style="width:${d.progress}%; background:${d.status==='Failed' ? 'var(--danger)' : 'linear-gradient(90deg,var(--blue-500),var(--blue-700))'}"></div></div></td>
        <td><span class="pill ${pillClass(d.status)}">${d.status}</span></td>
        <td>${d.proof}</td>
        <td>${d.status==='Failed' ? `<button class="btn-sm" data-reschedule="${d.id}">Reschedule</button>` : '<span class="cell-sub">—</span>'}</td>
      </tr>
    `).join('');
    document.querySelectorAll('[data-reschedule]').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.reschedule as string;
        const d = deliveries.find(x => x.id === id);
        if(d){ d.status = 'Rescheduled'; toast(`${d.id} rescheduled for next delivery slot.`); }
        renderDeliveryStrip(); renderDeliveryTable(); renderKpis();
      });
    });
    document.getElementById('navDelivery')!.textContent = String(deliveries.filter(d=>d.status==='Out for Delivery').length);
  }

  // ==================================================================
  // PARCEL OPERATIONS
  // ==================================================================
  function renderScanLog(){
    document.getElementById('scanLog')!.innerHTML = scanLogData.slice(0,8).map(s => `
      <div class="scan-row">
        <span class="pill ${s.type==='Incoming' ? 'blue' : 'amber'}">${s.type}</span>
        <span class="cell-id mono">${s.id}</span>
        <span class="cell-sub" style="margin-left:auto;">${s.time}</span>
      </div>
    `).join('') || `<div class="cell-sub">No scans yet — enter a tracking ID above.</div>`;
  }
  function doScan(type: string){
    const input = document.getElementById('scanInput') as HTMLInputElement;
    const val = input.value.trim();
    if(!val){ toast('Enter a tracking ID to scan.'); return; }
    scanLogData.unshift({id:val, type, time:'Just now'});
    input.value = '';
    renderScanLog();
    toast(`${type} scan recorded for ${val}`);
  }
  document.getElementById('scanInBtn')!.addEventListener('click', ()=>doScan('Incoming'));
  document.getElementById('scanOutBtn')!.addEventListener('click', ()=>doScan('Outgoing'));
  document.getElementById('reportDamagedBtn')!.addEventListener('click', ()=>toast('Damaged parcel report submitted.'));
  document.getElementById('reportMissingBtn')!.addEventListener('click', ()=>toast('Missing parcel alert raised to ops team.'));

  function renderParcelOpsTables(){
    (document.querySelector('#receivingTable tbody') as HTMLElement)!.innerHTML = receivingQueue.map(r => `
      <tr><td class="cell-id mono">${r.id}</td><td>${r.from}</td><td><span class="pill ${r.sort==='Sorted'?'green':(r.sort==='In Progress'?'amber':'gray')}">${r.sort}</span></td></tr>
    `).join('');
    (document.querySelector('#dispatchTable tbody') as HTMLElement)!.innerHTML = dispatchQueue.map(r => `
      <tr><td class="cell-id mono">${r.id}</td><td>${r.to}</td><td><span class="pill ${r.status==='Loading'?'amber':'blue'}">${r.status}</span></td></tr>
    `).join('');
    (document.querySelector('#transferTable tbody') as HTMLElement)!.innerHTML = transferHistory.map(r => `
      <tr><td class="cell-id mono">${r.id}</td><td><span class="pill ${r.dir==='Inbound'?'blue':'amber'}">${r.dir}</span></td><td>${r.branch}</td><td>${r.date}</td></tr>
    `).join('');
  }

  // ==================================================================
  // WAREHOUSE
  // ==================================================================
  function renderWarehouse(){
    const cells = [];
    for(let i=0;i<60;i++){
      const r = Math.random();
      cells.push(r < 0.35 ? 'low' : r < 0.75 ? 'mid' : 'high');
    }
    document.getElementById('shelfGrid')!.innerHTML = cells.map(c => `<div class="shelf-cell" data-occ="${c}"></div>`).join('');
    document.getElementById('capacityDonut')!.style.background = `conic-gradient(var(--blue-600) 0% 72%, var(--gray-tint) 72% 100%)`;
    document.getElementById('warehouseStrip')!.innerHTML = `
      <div class="ss-item"><div class="ss-num">1,860</div><div class="ss-lbl">Total Stored Parcels</div></div>
      <div class="ss-item"><div class="ss-num">140</div><div class="ss-lbl">Incoming Inventory</div></div>
      <div class="ss-item"><div class="ss-num">158</div><div class="ss-lbl">Outgoing Inventory</div></div>
      <div class="ss-item"><div class="ss-num">${agingParcels.length}</div><div class="ss-lbl">Aging Parcels</div></div>
    `;
    (document.querySelector('#agingTable tbody') as HTMLElement)!.innerHTML = agingParcels.map(a => `
      <tr><td class="cell-id mono">${a.id}</td><td>${a.shelf}</td><td>${a.days} days</td><td><span class="pill ${a.days>5?'red':'amber'}">${a.status}</span></td></tr>
    `).join('');
  }

  // ==================================================================
  // RIDERS
  // ==================================================================
  function renderRiders(){
    const online = riders.filter(r=>r.status==='online').length;
    const offline = riders.filter(r=>r.status==='offline').length;
    const busy = riders.filter(r=>r.status==='busy').length;
    document.getElementById('riderStrip')!.innerHTML = `
      <div class="ss-item"><div class="ss-num">${riders.length}</div><div class="ss-lbl">Total Riders Assigned</div></div>
      <div class="ss-item"><div class="ss-num">${online}</div><div class="ss-lbl">Online / Available</div></div>
      <div class="ss-item"><div class="ss-num">${busy}</div><div class="ss-lbl">On Delivery</div></div>
      <div class="ss-item"><div class="ss-num">${offline}</div><div class="ss-lbl">Offline</div></div>
    `;
    document.getElementById('riderGrid')!.innerHTML = riders.map(r => `
      <div class="rider-card">
        <div class="rider-top">
          <div class="av">${initials(r.name)}<span class="status-dot ${r.status}"></span></div>
          <div>
            <div class="r-name">${r.name}</div>
            <div class="r-vehicle">${r.vehicle}</div>
          </div>
        </div>
        <div class="rider-meta">
          <div><div class="rm-lbl">Status</div><div class="rm-val">${r.status==='online'?'Available':r.status==='busy'?'On Delivery':'Offline'}</div></div>
          <div><div class="rm-lbl">Success Rate</div><div class="rm-val">${r.success}%</div></div>
          <div><div class="rm-lbl">GPS Location</div><div class="rm-val" style="font-size:.72rem;">${r.gps}</div></div>
          <div><div class="rm-lbl">Performance</div><div class="stars">${'★'.repeat(Math.round(r.score))}${'☆'.repeat(5-Math.round(r.score))}</div></div>
        </div>
        <div class="rider-foot">
          <span class="cell-sub">${r.deliveries} deliveries today</span>
          <button class="btn-sm" data-assign-rider="${r.name}">Assign Shipment</button>
        </div>
      </div>
    `).join('');
    document.querySelectorAll('[data-assign-rider]').forEach((btn: Element) => {
      btn.addEventListener('click', () => toast(`Shipment assignment started for ${(btn as HTMLElement).dataset.assignRider}.`));
    });
    document.getElementById('navRiders')!.textContent = String(online + busy);
  }

  // ==================================================================
  // STAFF
  // ==================================================================
  function renderStaff(){
    (document.querySelector('#staffTable tbody') as HTMLElement)!.innerHTML = staff.map(s => `
      <tr>
        <td><div class="avatar-chip"><div class="av">${initials(s.name)}</div><div class="av-name">${s.name}</div></div></td>
        <td>${s.role}</td>
        <td><span class="pill ${s.attendance==='Present'?'green':(s.attendance==='On Leave'?'amber':'red')}">${s.attendance}</span></td>
        <td class="cell-sub">${s.contact}</td>
        <td><span class="pill blue">${s.perm}</span></td>
      </tr>
    `).join('');
  }

  // ==================================================================
  // SERVICE AREA
  // ==================================================================
  function renderZones(){
    (document.querySelector('#zoneTable tbody') as HTMLElement)!.innerHTML = zones.map(z => `
      <tr>
        <td style="font-weight:700;">${z.zone}</td>
        <td class="mono cell-sub">${z.codes}</td>
        <td>${z.radius}</td>
        <td><span class="pill ${z.sameDay?'green':'gray'}">${z.sameDay?'Available':'Not available'}</span></td>
        <td><span class="pill ${z.express?'blue':'gray'}">${z.express?'Available':'Not available'}</span></td>
      </tr>
    `).join('');
  }

  // ==================================================================
  // LIVE MAP
  // ==================================================================
  function renderMap(){
    const mapPickups = [{x:22,y:30,label:'PK-70233'},{x:70,y:20,label:'PK-70234'}];
    const mapDeliveries = [{x:35,y:70,label:'FX-582012'},{x:80,y:60,label:'FX-582015'},{x:55,y:85,label:'FX-582020'}];
    const activeRiders = riders.filter(r=>r.status!=='offline').slice(0,7).map((r,i)=>({
      x: 15 + (i*11)%80, y: 15 + ((i*23)%75), busy:r.status==='busy', name:r.name
    }));
    let html = `<div class="map-pin branch" style="left:50%; top:50%;"><div class="pin-dot"></div><div class="pin-label">Lahore Central</div></div>`;
    activeRiders.forEach(r => {
      html += `<div class="map-pin rider ${r.busy?'':'idle'}" style="left:${r.x}%; top:${r.y}%;">`;
      if(r.busy) html += `<div class="pulse" style="left:0; top:-2px;"></div>`;
      html += `<div class="pin-dot"></div><div class="pin-label">${r.name.split(' ')[0]}</div></div>`;
    });
    mapPickups.forEach(p => { html += `<div class="map-pin pickup" style="left:${p.x}%; top:${p.y}%;"><div class="pin-dot"></div><div class="pin-label">${p.label}</div></div>`; });
    mapDeliveries.forEach(d => { html += `<div class="map-pin delivery" style="left:${d.x}%; top:${d.y}%;"><div class="pin-dot"></div><div class="pin-label">${d.label}</div></div>`; });
    document.getElementById('mapWrap')!.innerHTML = html;
  }

  // ==================================================================
  // REPORTS
  // ==================================================================
  function renderReports(){
    const week = [{d:'Mon',v:360},{d:'Tue',v:388},{d:'Wed',v:410},{d:'Thu',v:395},{d:'Fri',v:430},{d:'Sat',v:448},{d:'Sun',v:412}];
    const max = Math.max(...week.map(w=>w.v));
    document.getElementById('weeklyChart')!.innerHTML = week.map(w => `
      <div class="bar-col"><div class="bar-val">${w.v}</div><div class="bar" style="height:${(w.v/max*100)}%"></div><div class="bar-lbl">${w.d}</div></div>
    `).join('');

    document.getElementById('successDonut')!.style.background = `conic-gradient(var(--success) 0% 91%, var(--danger) 91% 96%, var(--faint) 96% 100%)`;

    const top = [...riders].sort((a,b)=>b.deliveries-a.deliveries).slice(0,6);
    (document.querySelector('#productivityTable tbody') as HTMLElement)!.innerHTML = top.map(r => `
      <tr>
        <td><div class="avatar-chip"><div class="av">${initials(r.name)}</div><div class="av-name">${r.name}</div></div></td>
        <td>${r.deliveries}</td>
        <td><span class="pill ${r.success>=93?'green':'amber'}">${r.success}%</span></td>
        <td>${(28 + Math.round(Math.random()*10))} min</td>
      </tr>
    `).join('');

    document.getElementById('cmpBody')!.innerHTML = [
      {label:'Delivery Success Rate', branch:91, network:87},
      {label:'On-Time Pickup Rate', branch:88, network:84},
      {label:'Avg. Delivery Time (lower is better)', branch:74, network:80},
    ].map(c => `
      <div class="cmp-row">
        <div class="cmp-head"><span>${c.label}</span><span>${c.branch}% vs ${c.network}%</span></div>
        <div class="cmp-track">
          <div class="cmp-bar branch" style="width:${c.branch}%"></div>
        </div>
        <div class="cmp-track" style="margin-top:3px;">
          <div class="cmp-bar network" style="width:${c.network}%"></div>
        </div>
      </div>
    `).join('') + `<div class="cell-sub" style="margin-top:6px;"><span style="color:var(--blue-600); font-weight:700;">■</span> This branch &nbsp; <span style="color:var(--faint); font-weight:700;">■</span> Network average</div>`;

    document.getElementById('reportStrip')!.innerHTML = `
      <div class="ss-item"><div class="ss-num">28 min</div><div class="ss-lbl">Avg Delivery Time</div></div>
      <div class="ss-item"><div class="ss-num">89%</div><div class="ss-lbl">Pickup Efficiency</div></div>
      <div class="ss-item"><div class="ss-num">Rs 486,300</div><div class="ss-lbl">COD Collected Today</div></div>
      <div class="ss-item"><div class="ss-num">6</div><div class="ss-lbl">Customer Complaints (7d)</div></div>
      <div class="ss-item"><div class="ss-num">#2</div><div class="ss-lbl">Network Rank of 8 Branches</div></div>
    `;
  }

  // ==================================================================
  // NAV / VIEW SWITCHING
  // ==================================================================
  const pageMeta: Record<string, {title: string; sub: string}> = {
    overview:{title:'Overview', sub:"Lahore Central Branch · live operational snapshot"},
    pickups:{title:'Pickup Management', sub:'Today\u2019s pickup requests and rider assignment'},
    deliveries:{title:'Delivery Management', sub:'Track every order from ready to delivered'},
    parcelops:{title:'Parcel Operations', sub:'Scanning, sorting and inter-branch transfers'},
    warehouse:{title:'Warehouse Management', sub:'Storage capacity and inventory movement'},
    riders:{title:'Rider Management', sub:'Availability, location and performance'},
    staff:{title:'Branch Staff', sub:'Roles, attendance and permissions'},
    servicearea:{title:'Service Area Management', sub:'Zones, postal codes and delivery capabilities'},
    map:{title:'Live Operations Map', sub:'Real-time positions across the branch coverage area'},
    reports:{title:'Reports & Analytics', sub:'Performance trends and branch comparisons'},
    alerts:{title:'Alerts & Notifications', sub:'Everything flagged for review'},
  };
  function switchView(view: string){
    document.querySelectorAll('.navlink').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', (v as HTMLElement).dataset.panel === view));
    document.getElementById('pageTitle')!.textContent = pageMeta[view].title;
    document.getElementById('pageSub')!.textContent = pageMeta[view].sub;
    document.getElementById('sidebar')!.classList.remove('open');
    if(view === 'map') renderMap();
  }
  document.querySelectorAll('.navlink').forEach(btn => btn.addEventListener('click', () => switchView((btn as HTMLElement).dataset.view as string)));
  document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => switchView((btn as HTMLElement).dataset.goto as string)));
  document.getElementById('menuBtn')!.addEventListener('click', () => document.getElementById('sidebar')!.classList.toggle('open'));
  document.getElementById('bellBtn')!.addEventListener('click', () => switchView('alerts'));

  ['pickupSearch'].forEach(id => document.getElementById(id)!.addEventListener('input', renderPickupTable));
  document.getElementById('pickupStatusFilter')!.addEventListener('change', renderPickupTable);
  ['deliverySearch'].forEach(id => document.getElementById(id)!.addEventListener('input', renderDeliveryTable));
  document.getElementById('deliveryStatusFilter')!.addEventListener('change', renderDeliveryTable);

  // ==================================================================
  // INIT
  // ==================================================================
  renderKpis();
  renderTimeline();
  renderAlerts();
  renderQuickActions();
  renderPickupStrip();
  renderPickupTable();
  renderDeliveryStrip();
  renderDeliveryTable();
  renderParcelOpsTables();
  renderScanLog();
  renderWarehouse();
  renderRiders();
  renderStaff();
  renderZones();
  renderReports();

                }
            }>

                

            </Script>
        </>
                );
}
