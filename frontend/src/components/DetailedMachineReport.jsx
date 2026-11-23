import React, { useState, useEffect } from 'react';
import { Search, Bell, User, Download, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

export default function DetailedMachineReport() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 10;

  const fetchDetailedReport = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ page, limit });
      if (search) queryParams.append('search', search);

      const response = await fetch(`${API_BASE}/reports/detailed?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch detailed report");
      
      const json = await response.json();
      setData(json.data);
      setTotal(json.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailedReport();
  }, [page]); // Re-fetch on page change

  // Handle Enter key for search
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setPage(1); // Reset to page 1 on new search
      fetchDetailedReport();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatNumber = (num, decimals = 2) => Number(num || 0).toFixed(decimals);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Running':
        return <span className="status-badge running"><CheckCircle2 size={12} /> Running</span>;
      case 'Idle':
        return <span className="status-badge idle"><AlertCircle size={12} /> Idle</span>;
      default:
        return <span className="status-badge offline"><XCircle size={12} /> Offline</span>;
    }
  };

  return (
    <div style={{ paddingBottom: 40, animation: 'fade-in 0.5s ease-in-out' }}>
      
      {/* SaaS Style Header */}
      <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <div className="search-wrap" style={{ position: 'relative', maxWidth: 320, width: '100%' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search Machine ID or Operator..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="form-input"
              style={{ paddingLeft: 42, background: 'var(--bg-card)', borderColor: 'var(--border-dim)' }}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Bell size={20} />
          </button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>
            <User size={18} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card report-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '24px 24px 16px 24px', margin: 0, borderBottom: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ fontSize: 16 }}>Detailed Machine Report</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" style={{ padding: '8px 16px', gap: 6, fontSize: 15 }} onClick={() => { setPage(1); fetchDetailedReport(); }}>
              <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> Refresh
            </button>
            <button className="btn btn-primary" style={{ padding: '8px 16px', gap: 6, fontSize: 15 }} onClick={handlePrint}>
              <Download size={14} /> Export Report
            </button>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table report-table">
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
                <th style={{ paddingRight: 24 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading report data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No report data found matching filters.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ paddingLeft: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{row.machine_name}</td>
                    <td>{row.operator_name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 14 }}>{formatDate(row.start_time)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 14 }}>{formatDate(row.end_time)}</td>
                    <td style={{ color: 'var(--accent-cyan)' }}>{formatNumber(row.working_hours)}h</td>
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

        {/* Pagination Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {Math.min(total, (page - 1) * limit + 1)} to {Math.min(total, page * limit)} of {total} entries
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="pagination-btn"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="pagination-info" style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-deep)', borderRadius: 'var(--radius)' }}>
              Page {page} of {totalPages}
            </div>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || total === 0}
              className="pagination-btn"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
