import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function encodeDate(dateStr: string): number {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}
