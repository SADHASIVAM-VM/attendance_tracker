import React, { useState } from 'react';
import { SpendCategory, SpendEntry } from '../../types/supervisor';
import {
  CloseIcon,
  Upload1Icon,
  Profile2Icon,
  LocationIcon,
  ErrorProfileIcon,
  BoxIcon,
  CoffeeIcon,
  TruckIcon,
  MoneyIcon,
  NoteTextIcon,
  CheckIcon,
} from '@astraicons/react/linear';

interface AddSpendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: Omit<SpendEntry, 'id' | 'isLocked' | 'time'>) => void;
  workersList: { id: string; name: string }[];
  currentWorksiteId: string;
  currencySymbol?: string;
  initialEntry?: SpendEntry | null;
}

const CATEGORIES: { label: SpendCategory; icon: any }[] = [
  { label: 'Materials', icon: BoxIcon },
  { label: 'Food', icon: CoffeeIcon },
  { label: 'Transport', icon: TruckIcon },
  { label: 'Worker payment', icon: MoneyIcon },
  { label: 'Other', icon: NoteTextIcon },
];

export const AddSpendSheet: React.FC<AddSpendSheetProps> = ({
  isOpen,
  onClose,
  onSubmit,
  workersList,
  currentWorksiteId,
  currencySymbol = '₹',
  initialEntry = null,
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SpendCategory>('Food');
  const [appliesToType, setAppliesToType] = useState<'LOCATION' | 'WORKER'>('LOCATION');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    workersList[0]?.id || ''
  );
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Track previous isOpen and initialEntry id to ONLY reset when newly opened or when editing a different entry
  const prevIsOpenRef = React.useRef<boolean>(false);
  const prevEntryIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const wasClosed = !prevIsOpenRef.current && isOpen;
    const currentEntryId = initialEntry?.id || null;
    const entryChanged = currentEntryId !== prevEntryIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevEntryIdRef.current = currentEntryId;

    if (wasClosed || (isOpen && entryChanged)) {
      if (initialEntry) {
        setAmountStr(initialEntry.amount.toString());
        setSelectedCategory(initialEntry.category);
        setAppliesToType(initialEntry.appliesToType);
        setSelectedWorkerId(initialEntry.workerId || workersList[0]?.id || '');
        setNote(initialEntry.note || '');
        setDate(initialEntry.date);
        setReceiptUrl(initialEntry.receiptUrl || '');
      } else {
        setAmountStr('');
        setSelectedCategory('Food');
        setAppliesToType('LOCATION');
        setSelectedWorkerId(workersList[0]?.id || '');
        setNote('');
        setDate(new Date().toISOString().split('T')[0]);
        setReceiptUrl('');
      }
      setErrorMsg('');
    }
  }, [isOpen, initialEntry]);

  // If selectedWorkerId is empty and workersList arrives later, select first worker without clearing any user inputs
  React.useEffect(() => {
    if (!selectedWorkerId && workersList.length > 0) {
      setSelectedWorkerId(workersList[0].id);
    }
  }, [workersList, selectedWorkerId]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setAmountStr(val);
    if (errorMsg) setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSimulateSampleReceipt = () => {
    setReceiptUrl(
      'https://images.unsplash.com/photo-1554415707-9e4466bfe0c2?auto=format&fit=crop&w=600&q=80'
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amountStr, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount greater than 0');
      return;
    }
    if (!note.trim()) {
      setErrorMsg('Please provide a short description note for this expense');
      return;
    }

    const workerObj = workersList.find((w) => w.id === selectedWorkerId);

    onSubmit({
      amount: parsedAmount,
      category: selectedCategory,
      appliesToType: appliesToType,
      workerId: appliesToType === 'WORKER' ? selectedWorkerId : undefined,
      workerName: appliesToType === 'WORKER' ? workerObj?.name : undefined,
      note: note.trim(),
      receiptUrl: receiptUrl || undefined,
      date: date,
      worksiteId: currentWorksiteId,
    });

    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Form Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Spend Voucher"
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full z-50 bg-white rounded-t-[24px] sm:rounded-[20px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#E8EEF4] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              {initialEntry ? 'Edit Site Expense' : 'Record Site Expense'}
            </h3>
            <p className="text-xs text-[#6B7280]">
              {initialEntry ? 'Update recorded expense details' : 'Add money spent on site or workers'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          {/* Large Amount Input */}
          <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[16px] p-4 text-center">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Expense Amount ({currencySymbol})
            </label>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-slate-400">{currencySymbol}</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                value={amountStr}
                onChange={handleAmountChange}
                className="w-40 text-center text-3xl font-black text-slate-900 bg-transparent border-b-2 border-[#12A66A] focus:outline-none focus:border-[#0E8F5B] tabular-nums"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="text-xs font-bold text-[#111827] block mb-2">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ label, icon: Icon }) => {
                const isSelected = selectedCategory === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedCategory(label)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#12A66A] text-white shadow-xs scale-102'
                        : 'bg-white border border-[#E8EEF4] text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Applies To Selector */}
          <div>
            <label className="text-xs font-bold text-[#111827] block mb-2">
              Applies To <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-[12px]">
              <button
                type="button"
                onClick={() => setAppliesToType('LOCATION')}
                className={`py-2 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  appliesToType === 'LOCATION'
                    ? 'bg-white text-[#12A66A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LocationIcon className="w-3.5 h-3.5" />
                <span>Site in General</span>
              </button>

              <button
                type="button"
                onClick={() => setAppliesToType('WORKER')}
                className={`py-2 rounded-[10px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  appliesToType === 'WORKER'
                    ? 'bg-white text-[#12A66A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Profile2Icon className="w-3.5 h-3.5" />
                <span>Specific Worker</span>
              </button>
            </div>

            {/* Worker dropdown selector if WORKER applies */}
            {appliesToType === 'WORKER' && (
              <div className="mt-2.5">
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#E8EEF4] rounded-[10px] text-slate-800 font-medium focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A]"
                >
                  {workersList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Note (Required) */}
          <div>
            <label className="text-xs font-bold text-[#111827] block mb-1">
              Description / Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="e.g. Lunch for 8 workers or 2 cement bags"
              className="w-full text-xs p-3 bg-white border border-[#E8EEF4] rounded-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A]"
            />
          </div>

          {/* Date picker */}
          <div>
            <label className="text-xs font-bold text-[#111827] block mb-1">
              Expense Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[#E8EEF4] rounded-[10px] text-slate-800 font-medium focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A]"
              />
            </div>
          </div>

          {/* Optional Receipt Photo */}
          <div>
            <label className="text-xs font-bold text-[#111827] block mb-1">
              Receipt Voucher Photo <span className="text-slate-400 font-normal">(Optional)</span>
            </label>

            {receiptUrl ? (
              <div className="relative rounded-[12px] overflow-hidden border border-[#E8EEF4] h-28 bg-slate-50 flex items-center justify-center">
                <img src={receiptUrl} alt="Receipt preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label className="flex-1 py-3 border border-dashed border-[#12A66A]/40 rounded-[12px] bg-[#E6F7EF]/50 hover:bg-[#E6F7EF] text-[#12A66A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                  <Upload1Icon className="w-4 h-4" />
                  <span>Upload Receipt</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSimulateSampleReceipt}
                  className="px-3 py-3 border border-slate-200 rounded-[12px] text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Use Sample
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-[10px] text-xs text-rose-700 flex items-center gap-2">
              <ErrorProfileIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-[14px] text-sm font-bold shadow-md shadow-[#12A66A]/20 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckIcon className="w-4 h-4 stroke-[2.5]" />
              <span>{initialEntry ? 'Update Expense Entry' : 'Save Expense Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
