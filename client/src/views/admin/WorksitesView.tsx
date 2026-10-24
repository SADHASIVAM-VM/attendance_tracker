import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import { WorksiteModal, WorksiteData } from '../../components/worksites/WorksiteModal';
import {
  MapPin,
  Plus,
  Navigation,
  Globe,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Pencil,
  Search,
  Filter,
  RefreshCw,
  Building2,
  ShieldCheck,
  Layers,
  Compass,
  ArrowUpDown,
  Power,
} from 'lucide-react';

export const WorksitesView: React.FC = () => {
  const [worksites, setWorksites] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [worksiteToEdit, setWorksiteToEdit] = useState<WorksiteData | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'code' | 'radiusMeters'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    totalCount: 0,
    totalPages: 1,
    page: 1,
    limit: 10,
    offset: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    loadWorksites();
  }, [page, limit, searchTerm, statusFilter, sortBy, sortOrder]);

  const loadWorksites = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm.trim(),
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      const res = await apiRequest<any>(`/worksites?${queryParams.toString()}`);

      if (res && res.pagination && Array.isArray(res.data)) {
        setWorksites(res.data);
        setPagination({
          ...res.pagination,
          total: res.pagination.total ?? res.pagination.totalCount ?? 0,
          totalCount: res.pagination.totalCount ?? res.pagination.total ?? 0,
        });
      } else if (Array.isArray(res)) {
        // Fallback for raw array
        setWorksites(res);
        setPagination({
          total: res.length,
          totalCount: res.length,
          totalPages: Math.ceil(res.length / limit) || 1,
          page: 1,
          limit,
          offset: 0,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load worksites list', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setWorksiteToEdit(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (site: any) => {
    setWorksiteToEdit({
      id: site.id,
      name: site.name,
      code: site.code,
      address: site.address,
      description: site.description || '',
      latitude: site.latitude,
      longitude: site.longitude,
      radiusMeters: site.radiusMeters,
      maxAccuracyMeters: site.maxAccuracyMeters,
      isActive: site.isActive,
    });
    setModalOpen(true);
  };

  const handleSaveWorksite = async (data: WorksiteData) => {
    if (data.id) {
      // Edit mode: PATCH /worksites/:id
      await apiRequest(`/worksites/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          code: data.code,
          address: data.address,
          description: data.description,
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.radiusMeters,
          maxAccuracyMeters: data.maxAccuracyMeters,
          isActive: data.isActive,
        }),
      });
    } else {
      // Create mode: POST /worksites
      await apiRequest('/worksites', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          code: data.code,
          address: data.address,
          description: data.description,
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.radiusMeters,
          maxAccuracyMeters: data.maxAccuracyMeters,
          isActive: data.isActive,
        }),
      });
    }

    // Refresh data
    await loadWorksites();
  };

  const handleToggleActive = async (site: any) => {
    try {
      const newStatus = !site.isActive;
      await apiRequest(`/worksites/${site.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: newStatus,
        }),
      });
      toast.success(
        `Worksite "${site.name}" is now ${newStatus ? 'Active' : 'Inactive'}.`,
        newStatus ? 'Location Activated' : 'Location Deactivated'
      );
      loadWorksites();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update worksite status.', 'Status Update Failed');
    }
  };

  // Quick stats
  const totalCount = pagination.totalCount;
  const activeCount = useMemo(
    () => worksites.filter((s) => s.isActive).length,
    [worksites]
  );
  const strictCount = useMemo(
    () => worksites.filter((s) => (s.radiusMeters || 30) <= 30).length,
    [worksites]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-[#111827] m-0">
              Physical Worksites
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#12A66A] border border-[#A7F3D0]">
              {totalCount} Total Sites
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Authoritative physical coordinates and geofence enforcement boundaries.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-gradient-to-r from-[#12A66A] to-[#0E8F5B] hover:from-[#0E8F5B] hover:to-[#0A7349] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#12A66A]/20 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Add Worksite
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8EEF4] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Configured Sites
            </span>
            <span className="text-xl font-black text-[#111827]">{totalCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8EEF4] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Active Geofences
            </span>
            <span className="text-xl font-black text-[#12A66A]">{activeCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8EEF4] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Strict Buffer (≤30m)
            </span>
            <span className="text-xl font-black text-blue-600">{strictCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8EEF4] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Standard GPS Max
            </span>
            <span className="text-xl font-black text-amber-600">±50m</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E8EEF4] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by worksite name, site code, or street address..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0]">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#64748B] hover:text-[#111827]'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-xs font-bold text-[#475569]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [any, any];
                  setSortBy(field);
                  setSortOrder(order);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold text-[#111827] focus:outline-none cursor-pointer"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="code-asc">Code (A-Z)</option>
                <option value="radiusMeters-asc">Radius (Smallest First)</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadWorksites()}
              disabled={loading}
              className="p-2 rounded-xl border border-[#E8EEF4] text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              title="Refresh Worksites List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#12A66A]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Worksites List / Grid */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-[#E8EEF4] space-y-3">
          <RefreshCw className="w-8 h-8 text-[#12A66A] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#64748B]">Loading worksites...</p>
        </div>
      ) : worksites.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-[#E8EEF4] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-[#111827] m-0">No Worksites Found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'No worksites matched your search or filter criteria. Try clearing filters.'
              : 'No physical worksites have been registered yet. Add your first worksite to configure geofencing.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#12A66A] text-white rounded-xl text-xs font-bold hover:bg-[#0E8F5B] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Worksite
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worksites.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-[20px] border border-[#E8EEF4] p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header: Title, Code & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Building2 className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#111827] text-sm leading-tight m-0">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[11px] font-bold text-[#64748B] px-1.5 py-0.5 rounded bg-[#F1F5F9]">
                          {s.code}
                        </span>
                        {s.description && (
                          <span
                            className="text-[11px] text-[#94A3B8] truncate max-w-[120px]"
                            title={s.description}
                          >
                            • {s.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                </div>

                {/* Address */}
                <p className="text-xs text-[#475569] flex items-start gap-1.5 min-h-[32px] leading-relaxed">
                  <MapPin className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{s.address}</span>
                </p>

                {/* Coordinates & Geofence Specs */}
                <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#E8EEF4] text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#12A66A]" />
                      Coordinates:
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${Number(s.latitude).toFixed(
                        6
                      )},${Number(s.longitude).toFixed(6)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 text-[11px]"
                      title="Open in Google Maps"
                    >
                      {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B]">Geofence Radius:</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E6F7EF] text-[#0E8F5B] border border-[#A7F3D0]">
                      {s.radiusMeters} meters
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B]">Max GPS Accuracy:</span>
                    <span className="text-[11px] font-bold text-[#475569]">
                      ±{s.maxAccuracyMeters}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Card Footer */}
              <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleActive(s)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    s.isActive
                      ? 'text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-200 hover:bg-rose-50/50'
                      : 'text-[#12A66A] hover:text-[#0E8F5B] border-[#A7F3D0] hover:bg-[#E6F7EF]'
                  }`}
                  title={s.isActive ? 'Deactivate Worksite' : 'Activate Worksite'}
                >
                  <Power className="w-3 h-3" />
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(s)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E8EEF4] hover:border-[#12A66A] text-[#111827] hover:text-[#12A66A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Worksite
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && worksites.length > 0 && (
        <DataTablePagination
          metadata={pagination}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}

      {/* EDIT / CREATE WORKSITE MODAL */}
      <WorksiteModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setWorksiteToEdit(null);
        }}
        editWorksite={worksiteToEdit}
        onSubmit={handleSaveWorksite}
      />
    </div>
  );
};
