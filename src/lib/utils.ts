import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
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
