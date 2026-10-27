import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationMetadata {
  total: number;
  totalCount?: number;
  page: number;
  limit: number;
  offset: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface DataTablePaginationProps {
  metadata?: PaginationMetadata;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  metadata,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50],
  isLoading = false,
}) => {
  if (!metadata) return null;
  const total = metadata.total ?? metadata.totalCount ?? 0;
  const page = metadata.page ?? 1;
  const limit = metadata.limit ?? 10;
  const totalPages = metadata.totalPages ?? Math.ceil(total / limit) ?? 1;

  const startEntry = total === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, total);

  // Generate page numbers to display with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (page > 3) {
        pages.push('ellipsis');
      }
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) {
        pages.push('ellipsis');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3.5 bg-white border-t border-slate-200 rounded-b-2xl">
      {/* Left: Entries Counter & Rows Per Page Selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <div>
          Showing{' '}
          <span className="font-bold text-slate-900">{startEntry}</span> to{' '}
          <span className="font-bold text-slate-900">{endEntry}</span> of{' '}
          <span className="font-bold text-slate-900">{total}</span> entries
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Rows per page:</span>
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200">
            {pageSizeOptions.map((sz) => (
              <button
                key={sz}
                type="button"
                disabled={isLoading}
                onClick={() => onLimitChange(sz)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${limit === sz
                  ? 'bg-white text-[#12A66A] shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Page Navigation using Shadcn Pagination */}
      <div className="flex items-center gap-1">
        <Pagination className="mx-0 w-auto">
          <PaginationContent className="gap-1">
            {/* First Page Button */}
            <PaginationItem>
              <PaginationLink
                onClick={() => onPageChange(1)}
                disabled={page <= 1 || isLoading}
                className="hidden sm:inline-flex px-2"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>

            {/* Previous Page Button */}
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || isLoading}
              />
            </PaginationItem>

            {/* Page Number Buttons */}
            {getPageNumbers().map((p, idx) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={page === p}
                    onClick={() => onPageChange(p)}
                    disabled={isLoading}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            {/* Next Page Button */}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
              />
            </PaginationItem>

            {/* Last Page Button */}
            <PaginationItem>
              <PaginationLink
                onClick={() => onPageChange(totalPages)}
                disabled={page >= totalPages || isLoading}
                className="hidden sm:inline-flex px-2"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};
