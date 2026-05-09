import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    // If it's already a nicely formatted string (e.g. 09-May-24), return it as is
    if (/^\d{2}-[a-zA-Z]{3}-\d{2,4}$/.test(dateString.trim())) return dateString;
    return dateString;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  }).format(date);
}

export function formatNumber(num: number | undefined | null) {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat('en-US').format(num);
}
