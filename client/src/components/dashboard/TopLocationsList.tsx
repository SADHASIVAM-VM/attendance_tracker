import React, { useState } from 'react';
import { ChevronDown, Building2, MapPin, Award } from 'lucide-react';

export const TopLocationsList: React.FC = () => {
  const [timeframe, setTimeframe] = useState<string>('Monthly');

  const topSites = [
    {
      id: '1',
      name: 'Metro Line 4 - Gate 3',
      subtext: '482 punches • 99.1% on-site rate',
      stat: '99.4%',
      badge: 'Most Punctual',
      img: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f3?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '2',
      name: 'Airport Hub North Depot',
      subtext: '342 punches • 98.4% on-site rate',
      stat: '98.8%',
      badge: 'High Volume',
      img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '3',
      name: 'Central Logistics Yard',
      subtext: '286 punches • 97.9% on-site rate',
      stat: '97.9%',
      badge: 'Zero Absences',
      img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: '4',
      name: 'Tech Park Solar Array',
      subtext: '194 punches • 99.0% on-site rate',
      stat: '99.0%',
      badge: 'Top Safety',
      img: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=120&q=80',
    },
  ];

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Top Worksites</h3>
          <p className="text-xs text-[#6B7280]">Performance &amp; punctuality leaders</p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
        >
          <span>{timeframe}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-[#F8FAFC] mt-2">
        {topSites.map((site) => (
          <div
            key={site.id}
            className="py-3 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] p-2 rounded-xl transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <img
                src={site.img}
                alt={site.name}
                className="w-11 h-11 rounded-xl object-cover border border-[#E2E8F0]"
              />
              <div>
                <span className="font-semibold text-xs sm:text-sm text-[#111827] block group-hover:text-[#12A66A] transition-colors">
                  {site.name}
                </span>
                <span className="text-[11px] text-[#6B7280] block">
                  {site.subtext}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="font-bold text-sm text-[#12A66A] tabular-nums block  ">
                {site.stat}
              </span>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6F7EF] text-[#12A66A]">
                {site.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
