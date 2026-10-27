import React from 'react';
import { DataTablePagination, PaginationMetadata } from './data-table-pagination';

export { DataTablePagination };
export type { PaginationMetadata };

export interface ColumnDef<T> {
  key?: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor?: (item: T, index: number) => string | number;
  paginationMetadata?: PaginationMetadata;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  loadingMessage?: string;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  paginationMetadata,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50],
  isLoading = false,
  emptyMessage = 'No records found.',
  emptyState,
  loadingMessage = 'Loading data...',
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <tr>
              {columns.map((col, idx) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';
                return (
                  <th
                    key={col.key || String(col.accessorKey || idx)}
                    className={`py-3 px-4 ${alignClass} ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400 font-medium"
                >
                  <div className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#12A66A] border-t-transparent rounded-full animate-spin" />
                    <span>{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400"
                >
                  {emptyState || (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-600 text-xs">{emptyMessage}</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => {
                const key = keyExtractor
                  ? keyExtractor(item, rowIdx)
                  : item.id || item._id || rowIdx;

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item, rowIdx)}
                    className={`transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {columns.map((col, colIdx) => {
                      const alignClass =
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';

                      const cellContent = col.cell
                        ? col.cell(item, rowIdx)
                        : col.accessorKey
                        ? item[col.accessorKey]
                        : null;

                      return (
                        <td
                          key={col.key || String(col.accessorKey || colIdx)}
                          className={`py-3 px-4 ${alignClass} ${col.className || ''}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {paginationMetadata && onPageChange && onLimitChange && (
        <DataTablePagination
          metadata={paginationMetadata}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
          pageSizeOptions={pageSizeOptions}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
