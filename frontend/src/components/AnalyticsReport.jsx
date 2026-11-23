import React, { useState, useEffect } from 'react';
import { 
  Activity, Zap, Clock, Users, Filter, Download, 
  BarChart as BarChartIcon, Presentation, CheckCircle2, AlertCircle, XCircle, ChevronLeft, ChevronRight, Search, Bell, User, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AnalyticsReport() {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    machine_id: '',
    operator_name: '',
    shift: ''
  });

  const [availableFilters, setAvailableFilters] = useState({ machines: [], operators: [] });
  const [reportData, setReportData] = useState(null);
  
  // Detailed table state
  const [detailedData, setDetailedData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(false);
  const limit = 10;

  // 1. Load Filter options
  useEffect(() => {
    fetch(`${API_BASE}/reports/filters`)
      .then(res => res.json())
      .then(data => setAvailableFilters(data))
      .catch(err => console.error("Error fetching filters:", err));
  }, []);

  // 2. Fetch everything
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.start_date) q.append('start_date', filters.start_date);
      if (filters.end_date) q.append('end_date', filters.end_date);
      if (filters.machine_id) q.append('machine_id', filters.machine_id);
      if (filters.operator_name) q.append('operator_name', filters.operator_name);
      if (filters.shift) q.append('shift', filters.shift);

      // Fetch High-level Analytics
      const resA = fetch(`${API_BASE}/reports/analytics?${q.toString()}`);
      
      // Fetch Table Data
      q.append('page', page);
      q.append('limit', limit);
      if (searchQuery) q.append('search', searchQuery);
      const resB = fetch(`${API_BASE}/reports/detailed?${q.toString()}`);

      const [respA, respB] = await Promise.all([resA, resB]);
      
      if (respA.ok) {
        const dataA = await respA.json();
        setReportData(dataA);
      }
      
      if (respB.ok) {
        const dataB = await respB.json();
        setDetailedData(dataB.data);
        setTotalRecords(dataB.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [page]); // Re-fetch on pagination change

  const handleApplyFilters = () => {
    if (page !== 1) setPage(1);
    else fetchDashboardData();
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') handleApplyFilters();
  };

  const handlePrint = () => window.print();
  const formatNumber = (num, dec = 2) => Number(num || 0).toFixed(dec);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Running': return <span className="status-badge running"><CheckCircle2 size={12} /> Running</span>;
      case 'Idle': return <span className="status-badge idle"><AlertCircle size={12} /> Idle</span>;
      default: return <span className="status-badge offline"><XCircle size={12} /> Offline</span>;
    }
  };

  // Pie chart data preparation
  const pieData = reportData ? [
    { name: 'Active Hours', value: parseFloat(reportData.summary.active_hours) || 0, color: 'var(--accent-green)' },
    { name: 'Idle Hours', value: parseFloat(reportData.summary.idle_hours) || 0, color: 'var(--accent-amber)' }
  ].filter(d => d.value > 0) : [];

  return (
    <div style={{ paddingBottom: 60, animation: 'fade-in 0.5s ease-in-out' }}>
      
      {/* Power BI Style Top Identity & Toolbar */}
      <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
            <Activity style={{ color: 'var(--accent-cyan)' }} size={28} />
            <span>EXECUTIVE</span> DASHBOARD
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="search-wrap" style={{ position: 'relative', width: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search table..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="form-input"
              style={{ paddingLeft: 40, height: 38 }}
            />
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Bell size={20} />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,212,255,0.4)' }}>
            <User size={18} />
          </div>
          <button onClick={handlePrint} className="btn btn-primary" style={{ padding: '8px 16px', gap: 8 }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Power BI Global Slicers (Filters) */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 24px', borderTop: '4px solid var(--accent-cyan)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 13 }}>START DATE</label>
            <input type="datetime-local" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} className="form-input" style={{ height: 38 }} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 13 }}>END DATE</label>
            <input type="datetime-local" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} className="form-input" style={{ height: 38 }} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 13 }}>MACHINE DRILLDOWN</label>
            <select value={filters.machine_id} onChange={e => setFilters({...filters, machine_id: e.target.value})} className="form-input" style={{ height: 38 }}>
              <option value="">All Machines</option>
              {availableFilters.machines?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 13 }}>OPERATOR FILTER</label>
            <select value={filters.operator_name} onChange={e => setFilters({...filters, operator_name: e.target.value})} className="form-input" style={{ height: 38 }}>
              <option value="">All Operators</option>
              {availableFilters.operators?.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 13 }}>SHIFT SCHEDULE</label>
            <select value={filters.shift} onChange={e => setFilters({...filters, shift: e.target.value})} className="form-input" style={{ height: 38 }}>
              <option value="">All Shifts</option>
              <option value="1st Shift (6AM - 2PM)">1st Shift (6AM - 2PM)</option>
              <option value="2nd Shift (2PM - 10PM)">2nd Shift (2PM - 10PM)</option>
              <option value="3rd Shift (10PM - 6AM)">3rd Shift (10PM - 6AM)</option>
            </select>
          </div>
          <button onClick={handleApplyFilters} className="btn btn-primary" style={{ height: 38, width: '100%', justifyContent: 'center' }}>
            {loading ? <div className="spin-icon"><RefreshCw size={14} /></div> : 'Apply Filters'}
          </button>
        </div>
      </div>

      {reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPI Ticker Summary */}
          <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="metric-card amber" style={{ padding: 16 }}>
              <Zap className="metric-icon" style={{ top: 12, right: 12 }} />
              <div className="metric-label">Energy Usage</div>
              <div className="metric-value" style={{ fontSize: 32 }}>{formatNumber(reportData.summary.total_energy_kwh, 1)}<span className="metric-unit">kWh</span></div>
            </div>

            <div className="metric-card cyan" style={{ padding: 16 }}>
              <Clock className="metric-icon" style={{ top: 12, right: 12 }} />
              <div className="metric-label">Operational Hours</div>
              <div className="metric-value" style={{ fontSize: 32 }}>{formatNumber(reportData.summary.active_hours, 1)}<span className="metric-unit">hrs</span></div>
            </div>

            <div className="metric-card green" style={{ padding: 16 }}>
              <Activity className="metric-icon" style={{ top: 12, right: 12 }} />
              <div className="metric-label">Plant Efficiency</div>
              <div className="metric-value" style={{ fontSize: 32 }}>
                {reportData.summary.total_hours > 0 ? formatNumber((reportData.summary.active_hours / reportData.summary.total_hours) * 100, 1) : "0"}
                <span className="metric-unit">%</span>
              </div>
            </div>

            <div className="metric-card purple" style={{ padding: 16 }}>
              <Zap className="metric-icon" style={{ top: 12, right: 12 }} />
              <div className="metric-label">Mean Core Power</div>
              <div className="metric-value" style={{ fontSize: 32 }}>{formatNumber(reportData.summary.avg_power, 1)}<span className="metric-unit">kW</span></div>
            </div>
            
            <div className="metric-card teal" style={{ padding: 16 }}>
              <Activity className="metric-icon" style={{ top: 12, right: 12 }} />
              <div className="metric-label">Avg Line Voltage</div>
              <div className="metric-value" style={{ fontSize: 32 }}>{formatNumber(reportData.summary.avg_voltage_ln, 1)}<span className="metric-unit">V</span></div>
            </div>
          </div>

          {/* Advanced Predictive Metrics */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

            <div className="metric-card amber" style={{ padding: 16 }}>
              <Zap className="metric-icon" style={{ top: 12, right: 12, color: 'var(--accent-amber)' }} />
              <div className="metric-label">Peak Demand Spike</div>
              <div className="metric-value" style={{ fontSize: 26 }}>{formatNumber(reportData.summary.peak_power, 1)}<span className="metric-unit">kW</span></div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Highest recorded draw</div>
            </div>

            <div className="metric-card purple" style={{ padding: 16 }}>
              <Activity className="metric-icon" style={{ top: 12, right: 12, color: 'var(--accent-purple)' }} />
              <div className="metric-label">Average Power Factor</div>
              <div className="metric-value" style={{ fontSize: 26 }}>{formatNumber(reportData.summary.avg_pf, 3)}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Electrical delivery efficiency</div>
            </div>

          </div>

          {/* Visualizations Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
            
            {/* Trend Area Chart */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-dim)', paddingBottom: 10 }}>Energy Consumption Profile</div>
              <div className="chart-container" style={{ height: 260, minHeight: 260 }}>
                {reportData.trend_data?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.trend_data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.5}/>
                          <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                      <XAxis dataKey="time_bucket" stroke="var(--text-muted)" fontSize={14} tickFormatter={(tick) => tick.substring(5, 13)} />
                      <YAxis stroke="var(--text-muted)" fontSize={14} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-dim)' }} />
                      <Area type="monotone" dataKey="energy_consumed" name="Energy (kWh)" stroke="var(--accent-cyan)" strokeWidth={2} fillOpacity={1} fill="url(#colorEnergy)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No trend data</div>}
              </div>
            </div>

            {/* Operator Efficacy Bar Chart */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-dim)', paddingBottom: 10 }}>Staff Utilization</div>
              <div className="chart-container" style={{ height: 260, minHeight: 260 }}>
                {reportData.operator_stats?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.operator_stats} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={14} />
                      <YAxis type="category" dataKey="operator" stroke="var(--text-secondary)" fontSize={14} width={70} />
                      <RechartsTooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-dim)' }} />
                      <Bar dataKey="active_hours" name="Active Hrs" fill="var(--accent-purple)" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No operator data</div>}
              </div>
            </div>

            {/* Runtime Doughnut Status */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16, borderBottom: '1px solid var(--border-dim)', paddingBottom: 10 }}>Factory Time Distribution</div>
              <div className="chart-container" style={{ height: 260, minHeight: 260, position: 'relative' }}>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} stroke="var(--bg-card)" strokeWidth={3} dataKey="value" paddingAngle={2}>
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-dim)' }} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 14, color: 'var(--text-secondary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data</div>}
                
                {pieData.length > 0 && (
                  <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {formatNumber((reportData.summary.active_hours / (reportData.summary.total_hours || 1)) * 100, 0)}%
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: 1 }}>UPTIME</div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Drill-Down Detailed Matrix (Paginated Table) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '20px 24px', margin: 0, borderBottom: '1px solid var(--border-dim)', background: 'rgba(0,0,0,0.1)' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} style={{ color: 'var(--accent-cyan)' }} /> Session Drill-Down Matrix
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Machine ID</th>
                    <th>Operator</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Work Hrs</th>
                    <th>Idle Time</th>
                    <th>Energy Used</th>
                    <th>Efficiency</th>
                    <th style={{ paddingRight: 24 }}>Node Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && detailedData.length === 0 ? (
                    <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Retrieving operational matrix...</td></tr>
                  ) : detailedData.length === 0 ? (
                    <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No deep records found for applied filters.</td></tr>
                  ) : (
                    detailedData.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ paddingLeft: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{row.machine_name}</td>
                        <td style={{ fontWeight: 600 }}>{row.operator_name}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 14 }}>{formatDate(row.start_time)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 14 }}>{formatDate(row.end_time)}</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatNumber(row.working_hours)}h</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{formatNumber(row.idle_hours)}h</td>
                        <td style={{ color: 'var(--accent-purple)' }}>{formatNumber(row.energy_used)} kWh</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 40, height: 4, background: 'var(--border-dim)', borderRadius: 2 }}>
                              <div style={{ width: `${Math.min(100, row.efficiency)}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(row.efficiency, 1)}%</span>
                          </div>
                        </td>
                        <td style={{ paddingRight: 24 }}>
                          {getStatusBadge(row.status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Internal Pagination */}
            <div style={{ padding: '16px 24px', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {totalRecords === 0 ? 0 : Math.min(totalRecords, (page - 1) * limit + 1)} to {Math.min(totalRecords, page * limit)} of {totalRecords} logged sessions
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="pagination-btn">
                  <ChevronLeft size={16} /> Prev
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Page {page} / {totalPages}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalRecords === 0} className="pagination-btn">
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
